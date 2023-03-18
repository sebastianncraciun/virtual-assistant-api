'use strict';
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');
const config = require('./config');
const commandsRoutes=require('./routes/commands-routes')

const app = express()

app.use(express.json())
app.use(cors())
app.use(bodyParser.json());

app.use('/virtual-assistant-api/v1', commandsRoutes.routes)

app.listen(config.port, () => console.log('App is listening on url '+ config.url));