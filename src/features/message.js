/**
 * message
 * @author ydr.me
 * @create 2019-07-30 01:01:09
 * @update 2019-07-30 01:01:09
 */


'use strict';

var plan = require('blear.utils.plan');
var encryption = require('blear.node.encryption');
var xml2js = require('xml2js');


/**
 * 验证签名
 * @param query
 * @param query.signature
 * @param query.timestamp
 * @param query.nonce
 * @param messageToken
 * @returns {boolean}
 */
exports.verify = function (query, messageToken) {
    // 微信加密签名，signature结合了开发者填写的token参数和请求中的timestamp参数、nonce参数。
    var signature = query.signature;
    // 时间戳
    var timestamp = query.timestamp;
    // 随机数
    var nonce = query.nonce;

    // 1）将token、timestamp、nonce三个参数进行字典序排序
    // 2）将三个参数字符串拼接成一个字符串进行sha1加密
    // 3）开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
    var originStr = [messageToken, timestamp, nonce].sort().join('');
    var encryptedStr = encryption.sha1(originStr);
    return encryptedStr === signature;
};


/**
 * 解析入消息
 * @param body
 * @param callback
 */
exports.parseIncoming = function (body, callback) {
    plan
        .task(function (next) {
            xml2js.parseString(body.toString(), next);
        })
        .taskSync(function (ob) {
            var xml = ob.xml;
            return {
                from: xml.FromUserName[0],
                to: xml.ToUserName[0],
                at: new Date(xml.CreateTime[0] * 1000),
                type: xml.MsgType[0],
                content: xml.Content[0],
                id: xml.MsgId[0]
            };
        })
        .serial(callback);
};


/**
 * 发出消息包装
 * @param from
 * @param to
 * @param type
 * @param content
 * @returns {string}
 */
exports.wrapOutgoing = function (from, to, type, content) {
    // text
    // image
    // voice
    // video
    // music
    // news
    return '<xml>' +
        /**/'<ToUserName><![CDATA[' + from + ']]></ToUserName>' +
        /**/'<FromUserName><![CDATA[' + to + ']]></FromUserName>' +
        /**/'<CreateTime>' + Date.now() + '</CreateTime>' +
        /**/'<MsgType><![CDATA[' + type + ']]></MsgType>' +
        /**/'<Content><![CDATA[' + content + ']]></Content>' +
        '</xml>';
};

