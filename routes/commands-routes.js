const express = require('express')

const { addCommand, getAllDocIds, getTest } = require('../controllers/commandController')

const router = express.Router()

router.post('/defaultCommands', addCommand)
router.get('/commands', getAllDocIds)
router.get('/test', getTest)

module.exports = {
    routes: router
}