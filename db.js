const { initializeApp, cert } = require('firebase-admin/app')
const serviceAccount = require('./key.json')
initializeApp({
    credential: cert(serviceAccount)
})

const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore().collection('defaultCommands');

module.exports = db;