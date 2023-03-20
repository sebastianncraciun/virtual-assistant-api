const { initializeApp, cert } = require('firebase-admin/app')
const serviceAccount = require('./key.json')
initializeApp({
    credential: cert(serviceAccount)
})

const { getFirestore } = require('firebase-admin/firestore');

const defaultCommands = getFirestore().collection('defaultCommands');
dynamicCommands = getFirestore().collection('dynamicCommands');

module.exports = {
    defaultCommands,
    dynamicCommands
} 