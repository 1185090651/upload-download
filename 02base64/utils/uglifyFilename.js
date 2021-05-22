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