'use strict';
const firebase = require('../db');
const axios = require('axios');
const config = require('../config');
const { findBestDotProduct } = require('../utils');

const headers =config.api_openai_header

const data = {
  model: config.api_model,
  input: ['back', 'go back', 'select', 'edit']
};
//const Command = require('../models/command');

const addCommand = async (req, res, next) => {
    try {
      axios.post(config.api_url, data, { headers })
  .then(response => {
    //console.log(response.data);
    //const dotProductValue = dotProduct(response.data.data[0].embedding, response.data.data[1].embedding);
    const matrices = response.data.data.filter(elem => elem.index > 0)//.map(elem => elem.embedding);
    const bestResult  = findBestDotProduct(response.data.data[0].embedding, matrices);
    const bestProductValue = bestResult.bestProductValue;
    const bestMatrixIndex = bestResult.bestMatrixIndex;
    res.send(`The best dot product value of [0] and [${bestMatrixIndex}] is ${bestProductValue}`);
  })
  .catch(error => {
    console.error(error);
  });
      //res.status(200).json("success")
    } catch (err) {
      console.log(err)
    }
}

const getAllCommands = async (req, res, next) => {
    try{
        const data = await firebase.get()
        if(data.empty) {
            res.status(404).send('No command record found');
        }else {
            res.send(data);
        }
    }catch (error) {
        res.status(400).send(error.message);
    }
}

module.exports = {
    addCommand,
    getAllCommands
}

/*
--exemplu input api
{
    "user_input":{
      "plain_text": "go back",
      "natural_language_interpretation": {}
    },
    "screen_actions":["id1","id2","id3","id4"]
  }

--exemplu post firestore
const citiesRef = db.collection('users');
const snapshot = await citiesRef.get();
snapshot.forEach(doc => {
  if(doc.data().hash1)
    console.log(doc.id, '=>', doc.data());
});
*/