const fs = require('fs')
const path = require('path');
const express = require('express');
const multiparty = require('multiparty')
const uglifyFilename = require('./utils/uglifyFilename')
const bufferSplit = require('./utils/bufferSplit')

const app = express();

app.use(express.static(path.resolve('./public')))

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.post('/upload', async (req, res) => {
    const contentType = req.headers['content-type']
    const boundary = '--' + contentType.split('; ')[1].split('=')[1]
    const arr = [];
    const buffer = await new Promise(resolve => {
        req.on('data', chunk => {
            arr.push(chunk)
        })
        req.on('end', () => {
            resolve(Buffer.concat(arr))
        })
    })
    console.log(buffer.toString())

    // 1. 用<分隔符>切分数据
    let result = bufferSplit(buffer, boundary)
    console.log(result.map(item => item.toString()))

    // 2. 删除数组头尾数据
    result.pop()
    result.shift()
    console.log(result.map(item => item.toString()))

    // 3. 将每一项数据中间的\r\n\r\n删除，得到最终结果
    result = result.map(item => item.slice(2, item.length - 2))
    console.log(result.map(item => item.toString()))

    // 4. 将每一项数据中间的\r\n\r\n删除，得到最终结果
    result.forEach(item => {
        let [info, data] = bufferSplit(item, '\r\n\r\n')

        // info为字段信息，这是字符串类型数据，直接转换成字符串，若为文件信息，则数据中含有一个回车符\r\n，可以据此判断数据为文件还是为普通数据
        info = info.toString()

        // 若为文件信息，则将Buffer转为文件保存
        if (info.indexOf('\r\n') >= 0) {
            // 获取字段名 name=file
            let infoResult = info.split('\r\n')[0].split('; ')
            let name = infoResult[1].split('=')[1]
            name = name.substring(1, name.length - 1)
            // 获取文件名 filename="upload.txt"
            let filename = infoResult[2].split('=')[1]
            filename = filename.substring(1, filename.length - 1)
            console.log(name)
            console.log(filename)
            // 将文件存储到服务器
            fs.writeFileSync(path.resolve(`./public/${filename}`), data)
        } else {
            // 若为数据，则直接获取字段名称和值
            let name = info.split('; ')[1].split('=')[1]
            name = name.substring(1, name.length - 1)
            const value = data.toString()
            console.log(name, value, '#####')
        }
    })
})

app.post('/upload2', (req, res) => {
    // 实例化Form
    let form = new multiparty.Form()
    // 设置单文件大小限制
    // form.maxFilesSize = 2 * 1024 * 1024;
    // 解析二进制流
    form.parse(req, function (err, fields, file) {
        // 处理错误
        if (err) {
            res.send({
                code: 1,
                err
            })
            return
        }
        // 得到上传文件信息
        const chunk = file.chunk[0]
        // md5加密无序化文件名
        let uglyFilename = uglifyFilename(chunk.originalFilename)
        // 文件的存放目录
        const chunkPath = path.join('./public', uglyFilename)
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
            msg: '上传成功',
            path: `http://localhost:3000/${uglyFilename}`
        })
    })
})

app.listen(3000, () => {
    console.log('server is running at http://localhost:3000');
})