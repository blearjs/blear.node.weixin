/**
 * weixin
 * @author ydr.me
 * @create 2015-12-08 11:08
 */


'use strict';

var howdo = require('blear.utils.howdo');
var object = require('blear.utils.object');
var random = require('blear.utils.random');
var number = require('blear.utils.number');
var encryption = require('blear.node.encryption');
var request = require('blear.node.request');
var Cache = require('blear.classes.cache');


var cache = new Cache();
var reHash = /#.*$/;
var ACCESS_TOKEN = 'accessToken';
var API_TICKET = 'apiTicket';
var WEIXIN_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
var WEIXIN_TICKET_URL = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket';


/**
 * 解析微信返回内容
 * @param body
 * @returns {*[]}
 */
var parseWeixinBody = function (body) {
    var json = {};

    try {
        json = JSON.parse(body);
        json.errcode = json.errcode || 0;
    } catch (err) {
        json.errcode = -1;
        json.errmsg = '数据解析失败';
    }

    return [json.errcode !== 0 ? new TypeError(json.errmsg || '未知错误') : null, json];
};

var configs = {
    cache: true,
    appId: '',
    secret: '',
    // 指定 令牌
    jsApiTicket: ''
};

exports.config = function (cf) {
    object.assign(configs, cf);
};


// 获取微信 access_token
var getAccessToken = function (callback) {
    var cached = cache.get(ACCESS_TOKEN);

    if (cached) {
        return callback(null, cached);
    }

    request({
        url: WEIXIN_TOKEN_URL,
        query: {
            grant_type: 'client_credential',
            appid: configs.appId || configs.appid,
            secret: configs.secret
        }
    }, function (err, body) {
        if (err) {
            return callback(err);
        }

        var args = parseWeixinBody(body);
        var json = args[1];

        err = args[0];

        if (err) {
            return callback(err);
        }

        if (configs.cache) {
            cache.set(ACCESS_TOKEN, json.access_token, json.expires_in * 900);
        }

        callback(err, json.access_token);
    });
};


// 获取微信 jsapi_ticket
var getJSApiTicket = function (callback) {
    if (configs.jsApiTicket) {
        return callback(null, configs.jsApiTicket);
    }

    var cached = cache.get(API_TICKET);

    if (cached) {
        return callback(null, cached);
    }

    howdo
        .task(getAccessToken)
        .task(function (next, accessToken) {
            request({
                url: WEIXIN_TICKET_URL,
                query: {
                    access_token: accessToken,
                    type: 'jsapi'
                }
            }, function (err, body) {
                if (err) {
                    return next(err);
                }

                var args = parseWeixinBody(body);
                var json = args[1];

                err = args[0];

                if (err) {
                    return next(err);
                }

                if (configs.cache) {
                    cache.set(API_TICKET, json.ticket, json.expires_in * 900);
                }

                next(err, json.ticket);
            });
        })
        .follow(callback);
};


/**
 * 签名算法
 * @param jsApiTicket {String} 用于签名的 jsapi_ticket
 * @param url {String} 用于签名的 url ，注意必须动态获取，不能 hardcode
 * @returns {Object}
 */
var signature = function (jsApiTicket, url) {
    var ret = {
        jsapi_ticket: jsApiTicket,
        nonceStr: random.string(),
        timestamp: number.parseInt(Date.now() / 1000),
        url: url.replace(reHash, '')
    };
    var keys = Object.keys(ret);

    keys = keys.sort();

    var list = [];

    keys.forEach(function (key) {
        list.push(key.toLowerCase() + '=' + ret[key]);
    });

    var str = list.join('&');
    var signature = encryption.sha1(str);

    return object.assign(ret, configs, {
        jsApiTicket: jsApiTicket,
        signature: signature,
        state: random.string()
    });
};


/**
 * URL 微信 JSSDK 签名
 * @param url
 * @param callback
 */
exports.JSSDKSignature = function (url, callback) {
    if (!configs.appId) {
        throw new Error('请调用`weixin.config({appId, secret:})`');
    }

    getJSApiTicket(function (err, jsAPITicket) {
        if (err) {
            return callback(err);
        }

        callback(null, signature(jsAPITicket, url));
    });
};




