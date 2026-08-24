const express = require('express');
const cors = require('cors');
const { connectToWhatsApp } = require('./whatsapp');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('WhatsPanda Backend is Running 🐼');
});

// Start WhatsApp Connection
connectToWhatsApp().catch(err => console.log('unexpected error: ' + err));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
