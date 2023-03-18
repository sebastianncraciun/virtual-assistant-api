const express = require('express')

const { addCommand, getAllDocIds } = require('../controllers/commandController')

const router = express.Router()

router.post('/defaultCommands', addCommand)
router.get('/commands', getAllDocIds)

module.exports = {
    routes: router
}