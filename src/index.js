/**
 * weixin
 * @doc http://mp.weixin.qq.com/wiki/17/c0f37d5704f0b64713d5d2c37b468d75.html
 * @author ydr.me
 * @create 2015-12-08 11:08
 * @update 2017年07月07日23:09:53
 */


'use strict';

var plan = require('blear.utils.plan');
var object = require('blear.utils.object');
var random = require('blear.utils.random');
var number = require('blear.utils.number');
var fun = require('blear.utils.function');
var encryption = require('blear.node.encryption');
var request = require('blear.node.request');

var reHash = /#.*$/;
var WEIXIN_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
var WEIXIN_TICKET_URL = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket';
var WEIXIN_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
var WEIXIN_USER_INFO = 'https://api.weixin.qq.com/sns/userinfo';
var configs = {
    debug: false,
    appId: '',
    appSecret: '',
    // 指定 js-api-ticket 方法
    getJsApiTicket: function (callback) {
        callback(new Error('未配置获取 js-api-ticket 方法'), {ticket: 'xxxx'});
    }
};

/**
 * 配置
 * @param cf
 */
exports.config = function (cf) {
    object.assign(configs, cf);
};

/**
 * URL 微信 js Api 签名
 * @param url
 * @param callback
 */
exports.jsApiSignature = function (url, callback) {
    getJsApiTicket(function (err, info) {
        if (err) {
            return callback(err);
        }

        callback(null, jsApiTicket(info, url));
    });
};

/**
 * 根据 code 获取 authorization accessToken
 * @param code
 * @param callback
 */
exports.getAuthorizationAccessToken = function (code, callback) {
    requestWeixin({
        url: WEIXIN_ACCESS_TOKEN_URL,
        query: {
            appid: configs.appId,
            secret: configs.appSecret,
            code: code,
            grant_type: 'authorization_code'
        },
        debug: configs.debug
    }, callback);
};

/**
 * 获取用户基本信息
 * @param openId
 * @param accessToken
 * @param callback
 */
exports.getUserInfo = function (openId, accessToken, callback) {
    requestWeixin({
        url: WEIXIN_USER_INFO,
        query: {
            access_token: accessToken,
            openid: openId,
            lang: 'zh_CN'
        },
        debug: configs.debug
    }, callback);
};

/**
 * 请求微信
 * @param options
 * @param callback
 */
exports.request = requestWeixin;

/**
 * 解析响应内容
 * @type {parseResponseBody}
 */
exports.parseResponseBody = parseResponseBody;


// ===============================================

// 请求微信
function requestWeixin(options, callback) {
    request(options, parseResponseCallback(callback));
}

// 获取微信 JSSDK jsapi_ticket
function getJsApiTicket(callback) {
    plan
        .task(function (next) {
            configs.getJsApiTicket(function (err, ret) {
                if (err) {
                    return next();
                }

                next(null, ret);
            });
        })
        .task(function (next, ret) {
            if (ret) {
                return next(null, ret);
            }

            plan
                .task(function (next) {
                    requestWeixin({
                        url: WEIXIN_TOKEN_URL,
                        query: {
                            grant_type: 'client_credential',
                            appid: configs.appId,
                            secret: configs.appSecret
                        },
                        debug: configs.debug
                    }, next);
                })
                .task(function (next, ret) {
                    requestWeixin({
                        url: WEIXIN_TICKET_URL,
                        query: {
                            access_token: ret.accessToken,
                            type: 'jsapi'
                        },
                        debug: configs.debug
                    }, next);
                })
                .serial(next);
        })
        .serial(callback);
}


/**
 * 解析内容为 JSON 对象
 * @param body
 * @param callback
 * @returns {*}
 */
function parseResponseBody(body, callback) {
    var ret = {};

    try {
        ret = JSON.parse(body);
        ret.errcode = ret.errcode || 0;
    } catch (err) {
        ret.errcode = -1;
        ret.errmsg = '数据解析失败';
    }

    if (ret.errcode !== 0) {
        return callback(new TypeError(ret.errmsg || '未知错误'));
    }

    if (ret.expires_in) {
        ret.expires_in = ret.expires_in * 1000;
        ret.expiresIn = ret.expires_in;
    }

    if (ret.access_token) {
        ret.accessToken = ret.access_token;
    }

    if (ret.refresh_token) {
        ret.refreshToken = ret.refresh_token;
    }

    if (ret.openid) {
        ret.openId = ret.openid;
    }

    if (ret.unionid) {
        ret.unionId = ret.unionid;
    }

    if (ret.headimgurl) {
        ret.avatar = ret.headimgurl;
    }

    callback(null, ret);
}


/**
 * 解析微信返回内容
 * @param callback
 */
function parseResponseCallback(callback) {
    callback = fun.noop(callback);

    return function (err, body) {
        if (err) {
            return callback(err);
        }

        parseResponseBody(body, callback);
    };
}


/**
 * 签名算法
 * @param info {String} 用于签名的 jsapi_ticket
 * @param url {String} 用于签名的 url ，注意必须动态获取，不能 hardcode
 * @returns {Object}
 */
function jsApiTicket(info, url) {
    var ret = {
        jsapi_ticket: info.ticket,
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

    return object.assign(ret, {
        appId: configs.appId,
        appSecret: configs.appSecret,
        jsApiTicket: info.ticket,
        signature: signature,
        state: random.string(),
        expiresIn: info.expiresIn
    });
}
