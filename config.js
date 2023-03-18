'use strict';
const dotenv = require('dotenv');
const assert = require('assert');

dotenv.config();

const {
    PORT,
    HOST,
    HOST_URL,
    API_OPENAI_URL,
    TOKEN,
    API_MODEL
} = process.env;

assert(PORT, 'PORT is required');
assert(HOST, 'HOST is required');

module.exports = {
    port: PORT,
    host: HOST,
    url: HOST_URL,
    api_url: API_OPENAI_URL,
    api_model: API_MODEL,
    api_openai_header: {
        'Content-Type': 'application/json',
        'Authorization': TOKEN
    }
}