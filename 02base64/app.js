const fs = require('fs')
const path = require('path');
const express = require('express');
const uglifyFilename = require('./utils/uglifyFilename')

const app = express();

app.use(express.static(path.resolve('./public')))

app.use(express.json());
app.use(express.urlencoded({extended: true, limit: '50mb'}));

app.post('/upload', (req, res) => {
    const {
        chunk,
        filename
    } = req.body;
    // md5加密无序化文件名
    let uglyFilename = uglifyFilename(filename)
    // 文件存储路径
    const chunkPath = path.join('./public', uglyFilename)
    // 正则替换声明头
    chunk = decodeURIComponent(chunk).replace(/^data:image\/\w+;base64,/, '')
    // 将base64转成buffer数据
    chunk = Buffer.from(chunk, 'base64')
    // 将buffer数据写入文件
    fs.writeFileSync(chunkPath, chunk)
    res.send({
        code: 0,
        msg: '上传成功',
        path: `http://localhost:3000/${uglyFilename}`
    })
})

app.listen(3000, () => {
    console.log('server is running at http://localhost:3000');
})