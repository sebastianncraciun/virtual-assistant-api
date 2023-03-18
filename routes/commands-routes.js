const express = require('express')

const { addCommand, getAllCommands } = require('../controllers/commandController')

const router = express.Router()

router.post('/defaultCommands', addCommand)
router.get('/commands', getAllCommands)

module.exports = {
    routes: router
}