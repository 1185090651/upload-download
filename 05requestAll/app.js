const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

app.use(express.static(path.resolve('./public')))

let sum = 0;

app.get('/test', (req, res) => {
    sum++
    res.send({ sum })
})

app.listen(3000, () => {
    console.log('server is running at http://localhost:3000')
})