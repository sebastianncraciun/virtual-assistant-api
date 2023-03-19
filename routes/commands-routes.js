const express = require('express')

const { addCommand, getAllDocIds, testRoute, postDefaultAction } = require('../controllers/commandController')

const router = express.Router()

router.post('/defaultCommands', addCommand)
router.get('/commands', getAllDocIds)
router.get('/test', testRoute)
router.post('/postDefaultAction', postDefaultAction)

module.exports = {
    routes: router
}