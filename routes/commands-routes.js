const express = require('express')

const { selectDefaultCommand, getAllDefaultCommandsIds, testRoute, postDefaultAction, selectDynamicCommand } = require('../controllers/commandController')

const router = express.Router()

router.post('/selectDefaultCommand', selectDefaultCommand)
router.post('/selectDynamicCommand', selectDynamicCommand)
router.get('/commands', getAllDefaultCommandsIds)
router.post('/test', testRoute)
router.post('/postDefaultAction', postDefaultAction)

module.exports = {
    routes: router
}