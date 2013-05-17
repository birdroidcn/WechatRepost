var request = require('request');
/**
 * @overview 发布不带图的微博
 * @param params
 * @param cb
 */
exports.publishWeibo = function(params,cb){
    request.post({
        uri: 'https://api.weibo.com/2/statuses/update.json',
        form  : {
            access_token : params.access_token,
            status : params.status
        }
    },cb);

};
exports.publishWeiboWithPic = function(params,cb){
    var r = request.post({
        uri:'https://upload.api.weibo.com/2/statuses/upload.json',
        headers :{
            'Content-Length' : 100
        }
    },cb);
    var form = r.form();
    form.append('access_token', params.access_token);
    form.append('status', encodeURIComponent(params.status));
    form.append('pic', request(params.pic));
};
/**
 * @overview 长链换短链
 * @param params
 * @param cb
 */
exports.getShorten = function(params,cb){
    request.get({
        uri: 'https://api.weibo.com/2/short_url/shorten.json',
        qs  : {
            access_token : params.access_token,
            url_long : params.url
        }
    },function(error,response,body){
        var result = JSON.parse(body);
        result.error ? cb(result.error) : cb(null,result.urls[0].url_short);
    });
};