const fs = require('fs')
const path = require('path')
const express = require('express');
const multiparty = require('multiparty')
const uglifyFilename = require('./utils/uglifyFilename')

const app = express();

app.use(express.static(path.resolve('./public')))

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

app.post('/chunk', (req, res) => {
    let form = new multiparty.Form()
    form.parse(req, function (err, fields, file) {
        if (err) {
            res.send({
                code: 1,
                err
            })
            return
        }
        // 上传切片信息
        const chunk = file.chunk[0]
        // 切片名称
        const filename = fields.filename[0]
        // 切片文件的文件夹名字
        let fileDir = filename.substring(0, filename.lastIndexOf('-'))
        // 切片存放的文件夹路径
        let filePath = path.join('./temp', fileDir)
        // 不存在文件夹 就创建
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath)
        }
        // 切片存储路径
        let chunkPath = path.join('./temp', fileDir, filename)
        // 创建读取临时缓存区的文件流
        let rs = fs.createReadStream(chunk.path)
        let ws = fs.createWriteStream(chunkPath)
        rs.pipe(ws)
        // 读取结束，删除缓存区文件，提高性能
        rs.on('end', () => {
            fs.unlinkSync(chunk.path)
        })
        res.send({
            code: 0,
            msg: '上传切片成功'
        })
    })
})

app.post('/merge', (req, res) => {
    const uploadDir = path.resolve('./temp')
    let {
        filename
    } = req.body;
    // 切片存放的文件夹路径
    let fileDir = `${uploadDir}/${filename.substring(0, filename.lastIndexOf('.'))}`
    // md5加密无序化文件名
    let uglyFilename = uglifyFilename(filename)
    // 文件存储路径
    let filePath = `${path.resolve('./public')}/${uglyFilename}`
    // 读取文件夹
    let pathList = fs.readdirSync(fileDir)
    // 将切片排序遍历合并 合并完毕删除
    pathList.sort((a, b) => a.localeCompare(b)).forEach(item => {
        fs.appendFileSync(filePath, fs.readFileSync(path.join(uploadDir, filename.substring(0, filename.lastIndexOf('.')), item)))
        fs.unlinkSync(path.join(fileDir, item))
    })
    // 删除存放切片的空文件夹
    fs.rmdirSync(fileDir)
    res.send({
        code: 0,
        msg: '合并切片成功',
        path: `http://localhost:3000/${uglyFilename}`
    })
})

app.listen(3000, () => {
    console.log('server is running at http://localhost:3000')
})