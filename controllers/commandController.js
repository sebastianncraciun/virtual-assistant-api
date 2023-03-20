'use strict';
const { defaultCommands, dynamicCommands } = require('../db')
const axios = require('axios');
const config = require('../config');
const { findBestDotProduct, validateDynamicScreenActions } = require('../utils');
var crypto = require('crypto');

const headers = config.api_openai_header

//const Command = require('../models/command');

const selectDefaultCommand = async (req, res, next) => {
  try {
    if (Object.keys(req.body).length === 0) {
      res.status(400).json({ "failed": "body is missing" })
    } else {
      if (req.body.user_input == null || req.body.screen_actions == null || req.body.user_input.plain_text == null || req.body.user_input.natural_language_interpretation == null) {
        res.status(400).json({ "failed": 'malformed request' })
      } else if (typeof req.body.user_input.plain_text !== 'string' || req.body.user_input.plain_text === "") {
        res.status(400).json({ "failed": "user_input.plain_text should be a non-empty string" })
      } else if (!Array.isArray(req.body.screen_actions) || !req.body.screen_actions.every(element => typeof element === 'string')) {
        res.status(400).json({ "failed": "screen_actions should be an array of strings" })
      } else {
        //Check if all the doc ids I receive exists in firestore
        const ids = req.body.screen_actions;

        // Get documents for the specified ids
        const snapshot = await defaultCommands.get();

        const firestoreIds = snapshot.docs.map((doc) => doc.id);

        // Check if all ids are found
        const notFoundIds = ids.filter((id) => !firestoreIds.includes(id));
        if (notFoundIds.length > 0) {
          res.status(404).send({ "failed": `Documents not found for ids: ${notFoundIds.join(',')}` });
        } else {
          //TODO: modify the ds of the db
          //check if the user_input text exists in firestore and return its command
          let found = false;
          let idCommand = 0;
          let bestProductValue = 0

          // Loop through the specified ids and check if the userInput plain_text matches the input
          const dataArray = [];
          for (const id of ids) {
            //const doc = await defaultCommands.doc(id).get();
            const data = await snapshot.docs.find(doc => doc.id === id).data();
            dataArray.push(data);
            const hash = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
            if (data.hasOwnProperty(hash)) {
              found = true;
              bestProductValue = data[hash].dotProduct
              idCommand = id;
              break;
            }

          }
          if (found) {
            res.status(200).json({ "success": idCommand, "dotProduct": bestProductValue });
          } else {
            //if not exist, call openai api and add also in db for the id specified by openai

            const data_for_openai = []
            data_for_openai.push(req.body.user_input.plain_text)
            for (const certificate of dataArray) {
              // const doc = await defaultCommands.doc(id).get();
              // const certificate = await doc.data()
              const hashes = Object.keys(certificate);

              for (const key of hashes) {
                const hashObj = certificate[key];

                if (hashObj && hashObj.hasOwnProperty('plain_text')) {
                  //console.log(id)
                  //console.log(doc.data())
                  data_for_openai.push(hashObj.plain_text)
                }
              }
            }
            const data = {
              model: config.api_model,
              input: data_for_openai
            }

            console.log(data_for_openai)


            let bestMatrixIndex = 0

            await axios.post(config.api_url, data, { headers })
              .then(response => {

                const matrices = response.data.data.filter(elem => elem.index > 0)//.map(elem => elem.embedding);
                const bestResult = findBestDotProduct(response.data.data[0].embedding, matrices);
                bestProductValue = bestResult.bestProductValue;
                bestMatrixIndex = bestResult.bestMatrixIndex;
                console.log(response.data)
                //res.send(`The best dot product value of [0] and [${bestMatrixIndex}] is ${bestProductValue}`);
              })
              .catch(error => {
                console.error(error);
                res.send({ "failed": error })
              });
            let displayedId = ""
            for (const id of ids) {
              const doc = await defaultCommands.doc(id).get();

              if (doc.exists) {
                const data = await doc.data();
                const hash_existent_object = crypto.createHash('md5').update(data_for_openai[bestMatrixIndex]).digest('hex');
                const hash_new_object = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
                if (data.hasOwnProperty(hash_existent_object)) {
                  displayedId = id
                  await defaultCommands.doc(id).update({
                    [hash_new_object]: {
                      plain_text: req.body.user_input.plain_text,
                      natural_language_interpretation: req.body.user_input.natural_language_interpretation,
                      dotProduct: bestProductValue
                    }
                  })
                    .then(() => {
                      console.log('Document updated successfully!');
                    })
                    .catch((error) => {
                      console.error('Error updating document: ', error);
                    });
                  break;
                }

              }
            }

            res.status(200).json({
              "success": displayedId,
              "dotProduct": bestProductValue
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn(err)
    res.status(500).json({ message: 'server error' })
  }
}


const getAllDefaultCommandsIds = async (req, res, next) => {
  try {
    const snapshot = await defaultCommands.get();

    const docs = await Promise.all(snapshot.docs.map(async (doc, index) => {
      const data = await doc.data();
      const firstElement = Object.values(data)[0];
      return {
        index: index,
        id: doc.id,
        firstPlainText: firstElement.plain_text
      };
    }));

    res.send(docs);
  } catch (error) {
    res.status(400).send(error.message);
  }
}

const postDefaultAction = async (req, res, next) => {
  try {
    if (Object.keys(req.body).length === 0) {
      res.status(400).json({ "failed": "body is missing" })
    } else {
      if (req.body.plain_text == null || req.body.natural_language_interpretation == null) {
        res.status(400).json({ "failed": 'malformed request' })
      } else if (typeof req.body.plain_text !== 'string' || req.body.plain_text === "") {
        res.status(400).json({ "failed": "user_input.plain_text should be a non-empty string" })
      }
      else {
        const hash_new_object = crypto.createHash('md5').update(req.body.plain_text).digest('hex');
        const newCertificate = {
          [hash_new_object]: {
            plain_text: req.body.plain_text,
            natural_language_interpretation: req.body.natural_language_interpretation,
          }
        };
        let ref = ""
        await defaultCommands.add(newCertificate)
          .then((docRef) => {
            ref = docRef.id
            console.log("Certificate document written with ID: ", docRef.id);
          })
          .catch((error) => {
            console.error("Error adding certificate document: ", error);
          });
        res.status(200).json({ "success": ref });
      }
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
}

const testRoute = async (req, res, next) => {
  //let hash_new_object = ''
  let bestMatrixIndex = 0;
  let bestProductValue = 0;
  let shown_hash = ''
  const data_for_openai = []
  data_for_openai.push(req.body.user_input.plain_text)

  for (let i = 0; i < req.body.screen_actions.length; i++) {

    const doc = await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).get();

    if (doc.exists) {
      const data = await doc.data();
      const hash_new_object = crypto.createHash('md5').update(req.body.screen_actions[i].actionDescription).digest('hex');
      console.log(hash_new_object)
      if(data.hasOwnProperty(hash_new_object)){
      const hashes_plain_texts = Object.keys(data[hash_new_object])
      console.log(hashes_plain_texts)
      if (data.hasOwnProperty(hash_new_object)) {
        for (const hash_plain_text of hashes_plain_texts) {
          data_for_openai.push(data[hash_new_object][hash_plain_text].plain_text)
        }

      } 
      }else {
        data_for_openai.push(req.body.screen_actions[i].actionDescription)
    }}
  }
  const requestOpenAI = {
    model: config.api_model,
    input: data_for_openai
  }
  await axios.post(config.api_url, requestOpenAI, { headers })
    .then(response => {

      const matrices = response.data.data.filter(elem => elem.index > 0)//.map(elem => elem.embedding);
      const bestResult = findBestDotProduct(response.data.data[0].embedding, matrices);
      bestMatrixIndex = bestResult.bestMatrixIndex;
      bestProductValue = bestResult.bestProductValue;
      console.log("best prod", bestResult.bestProductValue)
      console.log("best matr index", bestResult.bestMatrixIndex)
    })
    .catch(error => {
      console.error(error);
    });
  const hashMatrMax = crypto.createHash('md5').update(data_for_openai[bestMatrixIndex]).digest('hex');
  const hashUserInput = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
  for (let i = 0; i < req.body.screen_actions.length; i++) {

    const doc = await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).get();

    if (doc.exists) {
      const data = await doc.data();
      const hash_new_object = crypto.createHash('md5').update(req.body.screen_actions[i].actionDescription).digest('hex');
      const hash_plain_text = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
      const actionDescription = req.body.screen_actions[i].actionDescription

      // const hashes_plain_texts = Object.keys(data[hash_new_object])
      if (data.hasOwnProperty(hash_new_object)) {

        if (data[hash_new_object].hasOwnProperty(hashMatrMax)) {
          shown_hash = hash_new_object
          //add here and return that md5
          await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).update({
            [`${hash_new_object}.${hashUserInput}`]: {
              natural_language_interpretation: req.body.user_input.natural_language_interpretation,
              plain_text: req.body.user_input.plain_text,
              dotProduct: bestProductValue
            }
          })
        }
      }
      else {
        if (bestProductValue > 0.7) {
          await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).update({
            [hash_new_object]: {
              [hash_new_object]: {
                plain_text: actionDescription
              },
              [hashUserInput]: {
                natural_language_interpretation: req.body.user_input.natural_language_interpretation,
                plain_text: req.body.user_input.plain_text,
                dotProduct: bestProductValue
              }
            }
          })
            .then(() => {
              console.log('Document updated successfully!');
            })
            .catch((error) => {
              console.error('Error updating document: ', error);
            });
            shown_hash = hash_new_object
        } else {
          await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).update({
            [hash_new_object]: {
              [hash_new_object]: {
                plain_text: actionDescription
              }
            }
          })
          shown_hash = hash_new_object
        }
      }
    }
  }
  res.status(200).json({ "success": shown_hash, "dotProduct": bestProductValue });
}

const selectDynamicCommand = async (req, res, next) => {
  try {
    if (Object.keys(req.body).length === 0) {
      res.status(400).json({ "failed": "body is missing" })
    } else {
      if (req.body.user_input == null || req.body.screen_actions == null || req.body.user_input.plain_text == null || req.body.user_input.natural_language_interpretation == null) {
        res.status(400).json({ "failed": 'malformed request' })
      } else if (typeof req.body.user_input.plain_text !== 'string' || req.body.user_input.plain_text === "") {
        res.status(400).json({ "failed": "user_input.plain_text should be a non-empty string" })
      } else if (!validateDynamicScreenActions(req.body.screen_actions)) {
        res.status(400).json({ "failed": "screen_actions should be a non-empty array of dictionaries with 'dynamicAction' and 'actionDescription'" })
      } else {
        //make the openai request
        let bestMatrixIndex = 0;
        let bestProductValue = 0;
        const data_for_openai = []
        data_for_openai.push(req.body.user_input.plain_text)
        for (let i = 0; i < req.body.screen_actions.length; i++) {
          data_for_openai.push(req.body.screen_actions[i].actionDescription)
        }

        const snapshot = await dynamicCommands.get();

        for (let i = 0; i < req.body.screen_actions.length; i++) {

          if (req.body.screen_actions[i].actionDescription === data_for_openai[bestMatrixIndex]) {
            const actionDescription = req.body.screen_actions[i].actionDescription;
            const data = await snapshot.docs.find(doc => doc.id === req.body.screen_actions[i].dynamicAction).data();

            const hashDescription = crypto.createHash('md5').update(actionDescription).digest('hex');
            const hashUserInput = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');


            if (!data.hasOwnProperty(hashDescription)) {

              if (bestProductValue > 0.7) {
                await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).update({
                  [hashDescription]: {
                    [hashDescription]: {
                      plain_text: actionDescription
                    },
                    [hashUserInput]: {
                      natural_language_interpretation: req.body.user_input.natural_language_interpretation,
                      plain_text: req.body.user_input.plain_text,
                      dotProduct: bestProductValue
                    }
                  }
                })
                  .then(() => {
                    console.log('Document updated successfully!');
                  })
                  .catch((error) => {
                    console.error('Error updating document: ', error);
                  });
                res.status(200).json({ "success": hashDescription, "dotProduct": bestProductValue });
              } else {
                await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).update({
                  [hashDescription]: {
                    [hashDescription]: {
                      plain_text: actionDescription
                    }
                  }
                })
                res.status(200).json({ "success": hashDescription });
              }
            } else {
              await dynamicCommands.doc(req.body.screen_actions[i].dynamicAction).update({
                [`${hashDescription}.${hashUserInput}`]: {
                  natural_language_interpretation: req.body.user_input.natural_language_interpretation,
                  plain_text: req.body.user_input.plain_text,
                  dotProduct: bestProductValue
                }
              })
              res.status(200).json({ "success": hashDescription, "dotProduct": bestProductValue });
            }

          }

        }

        //res.status(200).json({ "success": hashes });
      }
    }

  } catch (err) {
    console.warn(err)
    res.status(500).json({ message: 'server error' })
  }
}

module.exports = {
  selectDefaultCommand,
  getAllDefaultCommandsIds,
  postDefaultAction,
  selectDynamicCommand,
  testRoute
}