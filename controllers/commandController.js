'use strict';
const firebase = require('../db');
const axios = require('axios');
const config = require('../config');
const { findBestDotProduct } = require('../utils');
var crypto = require('crypto');

const headers = config.api_openai_header

//const Command = require('../models/command');

const addCommand = async (req, res, next) => {
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
                const snapshot = await firebase.get();

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

                    // Loop through the specified ids and check if the userInput plain_text matches the input
                    const dataArray = [];
                    for (const id of ids) {
                        //const doc = await firebase.doc(id).get();


                        const data = await snapshot.docs.find(doc => doc.id === id).data();
                        dataArray.push(data);
                        const hash = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
                        if (data.hasOwnProperty(hash)) {
                            found = true;
                            idCommand = id;
                            break;
                        }

                    }
                    if (found) {
                        res.status(200).json({ "success": idCommand });
                    } else {
                        //if not exist, call openai api and add also in db for the id specified by openai

                        const data_for_openai = []
                        data_for_openai.push(req.body.user_input.plain_text)
                        for (const certificate of dataArray) {
                            // const doc = await firebase.doc(id).get();
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

                        let bestProductValue = 0
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
                            const doc = await firebase.doc(id).get();

                            if (doc.exists) {
                                const data = await doc.data();
                                const hash_existent_object = crypto.createHash('md5').update(data_for_openai[bestMatrixIndex]).digest('hex');
                                const hash_new_object = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
                                if (data.hasOwnProperty(hash_existent_object)) {
                                    displayedId = id
                                    await firebase.doc(id).update({
                                        [hash_new_object]: {
                                            plain_text: req.body.user_input.plain_text,
                                            natural_language_interpretation: req.body.user_input.natural_language_interpretation
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

                        res.status(200).json({ "success": displayedId });
                    }
                }
            }
        }
    } catch (err) {
        console.warn(err)
        res.status(500).json({ message: 'server error' })
    }
}


const getAllDocIds = async (req, res, next) => {
    try {
        const snapshot = await firebase.get();

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
            if (req.body.user_input == null || req.body.screen_actions == null || req.body.user_input.plain_text == null || req.body.user_input.natural_language_interpretation == null) {
                res.status(400).json({ "failed": 'malformed request' })
            } else if (typeof req.body.user_input.plain_text !== 'string' || req.body.user_input.plain_text === "") {
                res.status(400).json({ "failed": "user_input.plain_text should be a non-empty string" })
            } else if (!Array.isArray(req.body.screen_actions) || !req.body.screen_actions.every(element => typeof element === 'string')) {
                res.status(400).json({ "failed": "screen_actions should be an array of strings" })
            } else {
                const hash_new_object = crypto.createHash('md5').update(req.body.user_input.plain_text).digest('hex');
                const newCertificate = {
                    [hash_new_object]: {
                        plain_text: req.body.user_input.plain_text,
                        natural_language_interpretation: req.body.user_input.natural_language_interpretation
                    }
                };
                let ref = ""
                await firebase.add(newCertificate)
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
    const snapshot = await firebase.get();
    //console.log('snapshot', snapshot, '\n') -> array cu toate certificatele din colectie, functii, obiecte specifice acelui certificat etc.
    //const firestoreIds = snapshot.docs.map((doc) => console.log("Doc", doc.id)); //array cu id-uri din colectie
    //const doc = await firebase.doc('FfCMtAJosy404vKYVL5o').get(); // -> doar obiectul cu metadata despre un certificat anume (prima metoda returneaza toate cert, asta doar unul)
    const dataArray = [];
    const data1 = await snapshot.docs.find(doc => doc.id === 'FfCMtAJosy404vKYVL5o').data();
    dataArray.push(data1)
    const data2 = await snapshot.docs.find(doc => doc.id === 'cbU4PBxxOw4EGCsSZGU7').data();
    dataArray.push(data2)
    console.log("my certificates", dataArray)
    console.log("hashes", Object.keys(data1))
    res.status(200).json({ "success": "bravo coaie" });
}

module.exports = {
    addCommand,
    getAllDocIds,
    postDefaultAction,
    testRoute
}