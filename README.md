**实现一个可以任意扩展接口的服务器，且能上传文件和文件下载**
# 文件上传
## 探究原理
下面以文件上传为何需要使用 POST 请求、指定上传格式、后端如何接收等等展开


**为何是 POST 而不是 GET？**
由于客户端上传的文件大小是不确定的，所以 HTTP 协议规定，文件上传的数据要存放于请求正文中，而不能出现在 URL 的地址栏中，因为地址栏中可以存放的数据量太小(一般不超过2K)


**POST 请求主体类型？**
引入 MDN 上概念：
> **HTTP `POST` 方法** 发送数据给服务器. 请求主体的类型由 [`Content-Type`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Content-Type) 首部指定.
> PUT 和[`POST`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods/POST)方法的区别是,PUT方法是幂等的：连续调用一次或者多次的效果相同（无副作用）。连续调用同一个POST可能会带来额外的影响，比如多次提交订单。
> 一个 `POST` 请求通常是通过 [HTML 表单](https://developer.mozilla.org/en-US/docs/Learn/Forms)发送, 并返回服务器的修改结果. 在这种情况下, content type 是通过在 [`<form>`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/form) 元素中设置正确的 [`enctype`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/form#attr-enctype) 属性, 或是在 [`<input>`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/Input) 和 [`<button>`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/button) 元素中设置 [`formenctype`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/Input#attr-formenctype) 属性来选择的:
> - `application/``x-www-form-urlencoded`: 数据被编码成以 `'&'` 分隔的键-值对, 同时以 `'='` 分隔键和值. 非字母或数字的字符会被 [percent-encoding](https://developer.mozilla.org/zh-CN/docs/Glossary/percent-encoding): 这也就是为什么这种类型不支持二进制数据(应使用 `multipart/form-data` 代替).
> - `multipart/form-data`
> - `text/plain`
> 
当 POST 请求是通过除 HTML 表单之外的方式发送时, 例如使用 [`XMLHttpRequest`](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest), 那么请求主体可以是任何类型.

文件上传要求客户端表单提交特殊的请求——mutipart请求，即包含多部分数据的请求。所以文件上传表单对于表单数据的编码类型要求必须为 mutipart/form-data，即指定 form 表单的 enctype(encoding type)


使用默认的 `application/x-www-form-urlencoded` 做为 content type 的简单表单:
```json
POST / HTTP/1.1
Host: foo.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 13

say=Hi&to=Mom
```
使用 `multipart/form-data` 作为 content type 的表单:
```json
POST /test.html HTTP/1.1
Host: example.org
Content-Type: multipart/form-data;boundary="boundary"

--boundary
Content-Disposition: form-data; name="field1"

value1
--boundary
Content-Disposition: form-data; name="field2"; filename="example.txt"

value2
```
**后端是如何接收到这些数据的？**
这里使用简易的 Express 搭建服务，如下：
```javascript
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
```
上述代码中有两个重要的变量—— chunk 和 str
chunk 为代码块，因为 POST 请求整体采用二进制流的方式发送数据，我们无法直接拿到，只能通过监听 req 请求体的 data 事件(数据开始流入时触发)和 end 事件(数据停止流入时触发)才可以获取到请求数据，chunk 代码块为 Buffer 格式数据：
```javascript
<Buffer 75 73 65 72 3d 7a 73 26 70 77 64 3d 31 32 33>
```
如果只需要获取文本信息，可以定义一个 str 将所有的 chunk 拼接起来
关于`multipart/form-data`也是大致一样的思路，只不过解析规则有些不同


## 文件上传方式
关于文件上传我这里大概有三个方式，第一个 form 表单上述已经大致解释明白了，因为这个方式基本被废弃，这里不再赘述


### Base64
> 服务器: 接收到客户端传递的base64信息，把base64转换为具体的文件存储并返回客户端存储的文件地址

**
**前端**
ajax 方便后面代码的通用性，这里用原生 XMLHttpRequest 做一层简单的封装来发送请求
```javascript
// request.js
var request = ({
    url,
    method = "post",
    data,
    headers = {},
    requestList
}) => {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        Object.keys(headers).forEach(key =>
            xhr.setRequestHeader(key, headers[key])
        );
        xhr.send(data);
        xhr.onload = e => {
            let data;
            try {
                data = JSON.parse(e.target.response)
            } catch (error) {
                data.e.target.response
            }
            resolve({
                data
            });
        };
    });
}
```
主要的上传逻辑
```html
<body>
    <input type="file" id="fileInp"><br/>
    <img id="serverImg">
</body>
</html>
<script src="./request.js"></script>
<script>
    // 封装生成base64格式的方法
    function changeFile(file) {
        return new Promise((resolve, reject) => {
            let readFile = new FileReader()
            readFile.readAsDataURL(file)
            readFile.onload = ev => {
                resolve(ev.target.result)
            }
        })
    }
    fileInp.onchange = async function () {
        // 获取上传的文件对象
        const file = fileInp.files[0]
        // 生成 base64
        const result = await changeFile(file)
        // 将 base64 传给后端
        const res = await request({
            url: '/upload',
            method: 'post',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            // 防止乱码
            data: `chunk=${encodeURIComponent(result)}&filename=${file.name}`
        })
        if (res.data.code === 0) {
            serverImg.src = res.data.path    
        }
    }
</script>
```


**后端**
考虑到文件名重复会对服务器文件存储造成一定影响，这里封装了一个 uglyFilename 来生成唯一文件名
```javascript
module.exports = (filename) => {
    // 最后一个点的在文件名的下标
    let dotIndex = filename.lastIndexOf('.'),
    // 文件名称
    name = filename.substring(0,dotIndex),
    // 文件后缀
    suffix = filename.substring(dotIndex+1);
    // md5加密文件名称并且加入时间戳实现唯一值
    name = require('crypto').createHash('md5').update(name).digest('hex')+new Date().getTime()
    // 返回加密后的文件名
    return `${name}.${suffix}`
}
```
413 Request Entity Too Large
上传数据时，报了一个 413 的错误，查了资料是因为 nginx 或者服务器对文件传输大小有限制，我这里没有使用 nginx，所以在解析 POST 请求体数据的部分加了个 limit 配置
```javascript
app.use(express.json()); // 解析json数据
app.use(express.urlencoded({extended: true, limit: '50mb'})); // 解析表单数据
```
上传接口
```javascript
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
```
从上面可以看出，这种转成 base64 的方式，对于图片上传还可以，对于其他文件的上传就无意义了


### FormData
> 服务器: 接收到客户端传递的文件信息，创建文件并返回客户端存储的文件地址



**前端**
思路和上面 Base64 相差不大，加了一些常用的限制
```html
<body>
    <!-- 非图片类型的文件变灰无法被点击 -->
    <input type="file" id="fileInp" accept="image/*">
    <br>
    <img id="serverImg">
</body>
</html>
<script src="./request.js"></script>
<script>
    const limitType = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    const limitMax = 100 * 1024;
    // 监听文件输入框的变化
    fileInp.onchange = async function () {
        // 获取文件对象
        let file = fileInp.files[0];
        // 排除上传非文件
        if (!file) return;
        // 限制上传类型mime type
        if (!limitType.includes(file.type)) {
            alert('不支持的上传格式！')
            fileInp.value = '';
            return
        }
        // 限制上传大小
        if (file.size > limitMax) {
            alert('最大只能上传100KB')
            fileInp.value = '';
            return
        }
        // 通过FormData类创建一个空对象
        let formData = new FormData()
        // 默认Content-Type: multipart/form-data
        // 通过append()方法来追加数据
        formData.append('chunk', file);
        console.log(formData)
        // 发送文件信息
        let res = await request({
            url: '/upload',
            method: 'POST',
            data: formData
        })
        if (res.data.code === 0) {
            serverImg.src = res.data.path
        }
    }
</script>
```


**后端**

- 这里回顾下上面的 content-type 为`multipart/form-data`发送到服务端的数据格式：
```javascript
------WebKitFormBoundaryL5AGcit70yhKB92Y
Content-Disposition: form-data; name="username"

lee
------WebKitFormBoundaryL5AGcit70yhKB92Y
Content-Disposition: form-data; name="password"

123456
Content-Disposition: form-data; name="file"; filename="upload.txt"
Content-Type: text/plain

upload
------WebKitFormBoundaryL5AGcit70yhKB92Y--
```

- 分析
1. 表单上传的数据，被分隔符"------WebKitFormBoundaryL5AGcit70yhKB92Y"隔开，分隔符在每次上传时都不同。分隔符数据可以从 `req.headers['content-type']` 中获取，如：
```javascript
const contentType = req.headers['content-type']; // multipart/form-data; boundary=----WebKitFormBoundaryL5AGcit70yhKB92Y
const boundary = '--' + contentType.split('; ')[1].split('=')[1] // ------WebKitFormBoundaryL5AGcit70yhKB92Y
```

2. 前两段数据中，分别可以获取到表单上传的字段名name="username"，以及数据"lee"
2. 第三段数据中，多了一个字段filename="upload.txt"，它表示的是文件的原始名称，以及可以获取到文件类型"Content-Type:text/plain"，表示这是一个文本文件，最后是文件的内容"upload"

由此可以看出，文件上传数据虽然有些乱，但还是有规律的，那么处理思路就是按照规律，将数据切割之后，取出其中有用的部分


- 上传数据结构分析

将上面数据的回车符标记出来：
```javascript
------WebKitFormBoundaryL5AGcit70yhKB92Y\r\n
Content-Disposition: form-data; name="username"\r\n
\r\n
lee\r\n
------WebKitFormBoundaryL5AGcit70yhKB92Y\r\n
Content-Disposition: form-data; name="password"\r\n
\r\n
123456\r\n
Content-Disposition: form-data; name="file"; filename="upload.txt"\r\n
Content-Type: text/plain\r\n
\r\n
upload\r\n
------WebKitFormBoundaryL5AGcit70yhKB92Y--
```
可以看出，每段数据的结构是这样的：
```javascript
------WebKitFormBoundaryL5AGcit70yhKB92Y\r\nContent-Disposition: form-data; name="username"\r\n\r\nlee\r\n
```
将每段上传数据简化如下：
```javascript
<分隔符>\r\n字段头\r\n\r\n内容\r\n
```
也就是说，整个表单的数据，就是按照这样的数据格式组装而成
需要注意的是，在表单数据的结尾不再是\r\n，而是"--"


- 上传数据处理步骤
1. 用分隔符切分数据
```json
[
  ‘’,
  "\r\n字段信息\r\n\r\n内容\r\n",
  "\r\n字段信息\r\n\r\n内容\r\n",
  "\r\n字段信息\r\n\r\n内容\r\n",
  '--'
]
```

2. 删除数组头尾数据：
```json
[
  "\r\n字段信息\r\n\r\n内容\r\n",
  "\r\n字段信息\r\n\r\n内容\r\n",
  "\r\n字段信息\r\n\r\n内容\r\n",
]
```

3. 将每一项数据头尾的的\r\n删除：
```json
[
  "字段信息\r\n\r\n内容",
  "字段信息\r\n\r\n内容",
  "字段信息\r\n\r\n内容",
]
```

4. 将每一项数据中间的\r\n\r\n删除，得到最终结果：
```json
[
	"字段信息", "内容",
	"字段信息", "内容",
	"字段信息", "内容",
]
```


- Buffer 数据处理

由于文件都是二进制数据，不能直接将其转换为字符串后再进行处理，否则数据会出错，因此要通过Buffer模块进行数据处理操作
Buffer模块提供了indexOf方法获取Buffer数据中，其参数所在位置的index值
Buffer模块提供了slice方法，可通过index值切分Buffer数据
> 测试Buffer

```javascript
const buffer = Buffer.from('lee\r\nchen\r\ntest')
const index = buffer.indexOf('\r\n')
console.log(index) // 3
console.log(buffer.slice(0, index).toString()) // 'lee'
```
由此可以封装一个专门用于切割Buffer数据的方法：
```javascript
module.exports = function bufferSplit(buffer, separator) {
  let result = [];
  let index = 0;

  while ((index = buffer.indexOf(separator)) != -1) {
    result.push(buffer.slice(0, index));
    buffer = buffer.slice(index + separator.length);
  }
  result.push(buffer);

  return result;
}
```

- 文件上传数据处理

show code!
```javascript
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
        if (info.indexOf('\r\n') >=0) {
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
```

- 使用第三方库——multiparty

虽然我们完成了完整的文件上传流程，但是实际工作中不可能自己从头开发所有功能，效率低并且通用型差
下面的代码可以测试下multiparty的功能
它会在field事件中，将数据信息的字段名和值返回，在file事件中，将文件的字段名和信息返回
上传成功后，会在指定的文件夹创建一个上传的文件，并会将文件重命名（如：IqUHkFe0u2h2TsiBztjKxoBR.jpg），以防止重名
若上传出现失败，已保存的文件会自动删除
close事件表示表单数据全部解析完成，用户可以在其中处理已经接收到的信息
不过我在使用中发现这个指定文件夹好像不可以配置，我还得将目标文件拷贝一份到我指定目录并删除源文件
> 示例代码

```javascript
const form = new multiparty.Form({
  uploadDir: './upload' // 指定文件存储目录
})
form.parse(req) // 将请求参数传入，multiparty会进行相应处理

form.on('field', (name, value) => { // 接收到数据参数时，触发field事件
  console.log(name, value)
 })

form.on('file', (name, file, ...rest) => { // 接收到文件参数时，触发file事件
  console.log(name, file)
})

form.on('close', () => {  // 表单数据解析完成，触发close事件
  console.log('表单数据解析完成')
})
```
> 实际项目中使用

```javascript
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
```


## 切片上传
> HTTP可以并发传递**6—7**个请求



### 切片上传步骤

1. 把大文件切片化（5个）
file是Blob的实例，Blob.prototype.silce可以把一个文件切片处理



2. 同时并发五个切片的上传请求
/chunk 处理每一个切片的请求
 chunk：文件切片
 filename：切片的名字 ->文件名-索引.后缀
upload目录下创建一个以文件名命名的临时目录，把切片存储到这个目录下
 xxxxx
 xxxxx-0-png
 xxxxx-1-png
 ....



3. 等5个切片都上传完，再向服务器发送一个合并切片的请求
/merge 合并
 filename：文件名 文件名.后缀
根据文件名找到之前存储的临时目录，按顺序读取目录中的切片信息，把每一个切片信息合并起来（合并完记得删除临时目录和里面的切片即可）



### 上传进度条
这里规定了一定会发送五个切片请求，所以给每一个请求*20即可，最终将所有数据存入数组
监听进度的变化使用的 ajax 的 `upload.onprogress` 方法
监听每个 item 进度变化使用的是 Proxy
```javascript
// 实例代理器修改进度
let _data = new Proxy([], {
    set(target, key, value) {
        target[key] = value;
        let sum = _data.reduce((prev, next) => {
            return prev + next
        }, 0)
        if (sum >= 100) {
            progress.innerHTML = '上传完成'
            return
        }
        progress.innerHTML = `${sum}%`
    }
})
```


### 前端代码
```javascript
<body>
    <input type="file" id="fileInp"><span id="progress">0%</span>
    <br>
    <img id="serverImg">
</body>

</html>
<script src="./request.js"></script>
<script>
    // 封装格式化文件名方法
    function formatFilename(filename, i) {
        // 最后一个点的在文件名的下标
        let dotIndex = filename.lastIndexOf('.'),
            // 文件名称
            name = filename.substring(0, dotIndex),
            // 文件后缀
            suffix = filename.substring(dotIndex + 1);
        name = `${name}-${i}`
        // 返回加密后的文件名
        return `${name}.${suffix}`
    }
    // 实例代理器修改进度
    let _data = new Proxy([], {
        set(target, key, value) {
            target[key] = value;
            let sum = _data.reduce((prev, next) => {
                return prev + next
            }, 0)
            if (sum >= 100) {
                progress.innerHTML = '上传完成'
                return
            }
            progress.innerHTML = `${sum}%`
        }
    })
    // 监听文件输入框的变化
    fileInp.onchange = async function () {
        // 获取文件对象
        let file = fileInp.files[0];
        // 把一个文件切成五个切片（固定切片数量，也可以固定切片大小）
        let partSize = file.size / 5;
        let cur = 0; // 当前的文件大小
        let i = 0; // 当前切片的索引
        let partList = []; //存放切片的数组

        while (i < 5) {
            partList.push({
                chunk: file.slice(cur, cur + partSize),
                filename: formatFilename(file.name, i)
            });
            cur += partSize;
            i++;
        }
        // 并发切片请求
        partList = partList.map(async (item, index) => {
            let formData = new FormData()
            formData.append('chunk', item.chunk);
            formData.append('filename', item.filename);
            let res = await request({
                url: '/chunk',
                method: 'POST',
                data: formData,
                onProgress: ev => {
                    _data[index] = Math.round(ev.loaded / ev.total * 20)
                }
            })
            if (res.data.code !== 0) return Promise.reject(res)
            return Promise.resolve(res)
        })
        // 合并切片
        await Promise.all(partList);
        // 发送合并切片请求
        let mergeRes = await request({
            url: '/merge',
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                filename: file.name
            })
        })
        if (mergeRes.data.code === 0) {
            serverImg.src = mergeRes.data.path
        }
    }
</script>
```


### 后端
核心逻辑和上面的无异，只是多了一层创建临时文件夹存储切片数据，而后删除的过程
```javascript
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
```


## 断点续传
断点续传难点

- 在于前端/服务端记住已上传的切片。这样下次上传就可以跳过之前已上传的部分
- 维持浏览器最大连接数，服务器储存已经上传的切片



### 生成Hash
对于文件的验证使用的是 `文件名 + 切片下标` 作为文件的 hash，这样前端文件名一旦修改就失去了效果，而事实上只要文件内容不变，hash 就不应该变化，所以这里我们改变之前的方案， 根据文件内容生成 hash
对于前后端比较匹配的项目，前端使用 web-worker 的 worker 线程或者后端做都可以完成，这里使用后端处理，解放前端
```javascript
var crypto = require('crypto');
var fs = require('fs');

//读取一个Buffer
var buffer = fs.readFileSync('./mindpush.apk');
var fsHash = crypto.createHash('md5');

fsHash.update(buffer);
var md5 = fsHash.digest('hex');
console.log("文件的MD5是：%s", md5);
```


### 维持浏览器最大并发数
之前对于此问题的处理我只停留在理论方面


- Promise.race 并发请求
- 请求和响应对应使用闭包
- 当一个请求完成时就 push 一个新请求

这个私下写过一次，感觉逻辑挺复杂的，还没有实现😭
这里使用之前面试的一家公司给我提供的解决办法
```javascript
const req = () => request({
    url: '/test',
    method: 'GET',
    data: {}
})
class RequestLimit {
    constructor(limit) {
        // 定义最大连接数
        this.limit = limit;
      	// 当前传入的请求数量
        this.cur = 0;
      	// 存储未调用的请求
        this.task = [];
    }
  	
    async req(request) {
      	// 当传入的请求数量大于最大连接数时，将请求存起来
        if (this.cur >= this.limit) {
          	// 此处将任务pending，等到前面的
            await new Promise(resolve => this.task.push(resolve))
        }
      	// 对传入的请求计数
        this.cur++;
      	// 调用请求
        try {
            await request();
        } catch (res) {
            return Promise.reject(res);
        // 请求结束之后 减去此请求 如果task中有为调用的请求就将其取出来调用
        } finally {
            this.cur--;
            if (this.task.length) {
                this.task.shift()();
            }
        }
    }
}
const requestLimit = new RequestLimit(5)
const arr = new Array(100).fill(req)
arr.forEach(item => {
    requestLimit.req(item)
})
```
后面就很简单啦，这里就不写了


参考资料：[ 用Vue实现一个大文件上传和断点续传](http://www.yiyong.info/article/115)


# 文件下载
## 直接下载
针对一些浏览器无法识别的文件格式，可以直接在地址栏输入URL即可触发浏览器的下载功能

- 浏览器地址栏输入文件URL
- window.location.href = URL
- window.open(URL)
## 直接下载(使用 a 标签 download 属性)
上面的直接下载只能用于浏览器无法识别的文件。如果是浏览器支持的文件格式(如： html、jpg、png)等，则不会触发文件下载，而是被浏览器直接触发解析展示
我们可以 a 标签的 download 属性，还可以设置文件名
```javascript
<a href="/images/download.jpg" download="myFileName">
```
如果不想展示 a 标签，可以使用如下写法
```javascript
const download = (filename, link) => {
    let DownloadLink = document.createElement('a'); 
    DownloadLink.style = 'display: none'; // 创建一个隐藏的a标签
    DownloadLink.download = filename;
    DownloadLink.href = link;
    document.body.appendChild(DownloadLink);
    DownloadLink.click(); // 触发a标签的click事件
    document.body.removeChild(DownloadLink);
}
```


## 直接下载(后端兼容处理 attachment)
浏览器识别的文件默认进行了解析，我们可以声明文件的 header 的 Content-Dispositon 信息，告诉浏览器该链接为下载附件链接
```javascript
Content-Disposition: attachment; filename="filename.xls" 
```
在 **Express** 中可以采用如下写法：
```javascript
app.get('/download', (req, res) => {
  let downloadFileName = 'app.js'
  let mimeType = mime.getType(downloadFileName)
  // ctx.response.headers['content-type'] = mimeType;

  let stats = fs.statSync(downloadFileName)
  if (stats.isFile()) {
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename=' + downloadFileName,
      'Content-Length': stats.size
    })
  }
  let rs = fs.createReadStream(downloadFileName)
  // let ws = fs.createWriteStream();
  rs.pipe(res)
})
```
在 **Koa** 中简易写法：
```javascript
router.get('/download/:filename', async ctx => {
	let { filename } = ctx.params
	let filePath = `./static/file/${filename}`
	ctx.attachment(filePath)
	await send(ctx, filePath)
})
```
参考资料： [前端文件下载的几种方式](https://www.jianshu.com/p/89dcef3eb9df)


# 代码：[upload-download](https://github.com/1185090651/upload-download)


完结...
