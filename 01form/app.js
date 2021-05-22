const express = require('express');
const path = require('path');

const app = express();

app.get('/', (req, res) => {
    res.sendFile(path.resolve('./public/index.html'))
})

app.post('/upload', (req, res) => {
    let str = ''
    req.on('data',chunk => {
        console.log(chunk)
        str += chunk
    })
    req.on('end', () => {
        res.send(str)
    })
})

app.listen(3000, () => {
    console.log('server is running at http://localhost:3000');
})