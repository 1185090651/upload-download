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
                data = e.target.response
            }
            resolve({
                data
            });
        };
    });
}