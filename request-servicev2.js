const http = require("http");
const http2 = require("http2");
const https = require("https");
const request = require('request');
const uri = require("url");
const querystring = require("querystring");
const zlib = require("zlib");
const merge = require("deepmerge")
const tls = require("tls");

const ErrorHandler = require("./error-service")();

const chrome_ciphers = "GREASE:TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA:AES256-SHA:DES-CBC3-SHA";

class H2Wrapper {
    constructor(options) {
        this.options = options || {};
        if (!this.options.ciphers) {
			this.options["ciphers"] = chrome_ciphers;
        }

        this.socket;
    }

	decodeReseponse(res) {
		return new Promise((resolve, reject) => {
			try {
				res.rawBody = "";
				res.body = "";
				let buf = Buffer.concat(res.data), headers = res.headers ? res.headers : {};
				if (buf && buf.length == 0) resolve();
				var encoding = headers['content-encoding'] ? headers['content-encoding'] : '', type = headers['content-type'] ? headers['content-type'] : '';
				switch (encoding) {
					case 'gzip':
						zlib.gunzip(buf, function (error, body) {
							if (error) {
								console.log(res)
								throw new Error(error)
							} else {
								res.rawBody = body.toString();
								res.body = type.includes("application/json") ? JSON.parse(res.rawBody) : res.rawBody;
								resolve();
							}
						});
						break;
					case 'deflate':
						zlib.inflate(buf, function (error, body) {
							if (error) {
								throw new Error(error)
							} else {
								res.rawBody = body.toString()
								res.body = type.includes("application/json") ? JSON.parse(res.rawBody) : res.rawBody;
								resolve();
							}
						});
						break;
					default:
						res.rawBody = buf.toString();
						res.body = type.includes("application/json") ? JSON.parse(res.rawBody) : res.rawBody;
						resolve();
						break;
				}
			} catch (error) {
				reject(error)
			}
		});
	}

    reorderHttpHeaders(options){
		const chrome = [
			"User-Agent",
			"DNT",
			"Accept",
			"Sec-Fetch-Site",
			"Sec-Fetch-Mode",
			"Sec-Fetch-Dest",
			"Referer",
			"Accept-Encoding",
			"Accept-Language",
			"Cookie"
		];
		let reorder = {
			"Host": options.headers["host"] ? options.headers["host"] : options.host,
			"Connection": "keep-alive",
		}
		for (let i = 0; i < chrome.length; i++) {
			let key = chrome[i];
			if (!reorder[key] && options.headers[key]) reorder[key] = options.headers[key];
		}
		for (var key in options.headers) {
			if (!reorder[key]) reorder[key] = options.headers[key];
		}
		return reorder;
    }

    reorderHttp2Headers(options){
		const chrome = [
			":method",
			":authority",
			":scheme",
			":path",
			"x-sec-clge-req-type",
			"dnt",
			"request-id",
			"user-agent",
			"accept",
			"origin",
			"sec-fetch-site",
			"sec-fetch-mode",
			"sec-fetch-dest",
			"referer",
			"accept-encoding",
			"accept-language",
			"cookie"
		];
		let reorder = {
			":method": options.headers[":method"] ? options.headers[":method"] : options.method,
			":authority": options.headers[":authority"] ? options.headers[":authority"] : options.host,
			":scheme": options.headers[":scheme"] ? options.headers[":scheme"] : options.protocol.slice(0, -1),
			":path": options.headers[":path"] ? options.headers[":path"] : options.path
		}
		for (let i = 0; i < chrome.length; i++) {
			let key = chrome[i];
			if (!reorder[key.toLowerCase()] && options.headers[key]) reorder[key.toLowerCase()] = options.headers[key];
		}
		for (var key in options.headers) {
			if (!reorder[key]) reorder[key.toLowerCase()] = options.headers[key];
		}
		return reorder;
    }

    buildRequest(url, opts = {}) {
        try {
            /* Set request options */
            let options = {};
			if (typeof url === "string" && typeof opts === "object") {
				options = { ...opts, ...uri.parse(url), url };
			} else if (typeof url === "object") {
				if (typeof url.url === "string") options = { ...opts, ...url,...uri.parse(url.url)};
				else options = { ...opts, ...url, url: url.toString() };
            };

			if (!options.method) {
				options.method = 'GET';
            };

			if (!options.url) {
				throw new Error("Missing URL param");
            };
            
            if (!options.port) options.port = options.protocol.slice(0, -1) === 'https' ? 443 : 80;
			options.origin = options.protocol + '//' + options.host;
			options = merge(this.options, options, {
				clone: false
            });

			if (options.jar) {
				options.headers["cookie"] = options.jar;
            };

            if (!this.options.body) this.options.body = "";

            if (this.options.json) this.options.headers["content-type"] = "application/json"

            return options;

        } catch (error) {
            throw new Error(error)
        }
    }

    buildClient(options){
        return new Promise( async (resolve, reject) => {
            try {

                if(this.options.debug) { options.proxy = "127.0.0.1:8888" };

                if (options.proxy && !ErrorHandler.isUndefined(options.proxy)) {
                    let proxySplit = options.proxy.split(":");
                    let reqOptions = {
                        method:'CONNECT',
                        host: proxySplit[0],
                        port: parseInt(proxySplit[1]),
                        path: `${(this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com"}:443`,
                        headers: {
                          host: (this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com"
                        }
                    };

                    if(proxySplit.length > 2) {
                        let auth = `${proxySplit[2]}:${proxySplit[3]}`
                        reqOptions["headers"] = {
                            "host": (this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com",
                            "Proxy-Authorization" : `Basic ${Buffer.from(auth).toString('base64')}`
                        }
                    }

                    /* build http proxy connection */
                    const req = await http.request(reqOptions);

                    req.on('socket', (socket) => {
                        let timeout = (this.options.timeout) ? this.options.timeout : 15000
                        socket.setTimeout(timeout);
                        socket.on('timeout', () => {
                            req.abort()
                        })
                    });

                    req.end();

                    req.once('error', (err) => {
                        reject(err);
                    });

                    req.once('timeout', () => {
                        reject(`Timeout Error`)
                    });

                    req.once('connect', (res, soc) => {
                        if(res.statusCode !== 200) { reject("Error connecting to proxy")};

                        const socket =  tls.connect({ 
                            ALPNProtocols: ['h2', 'http/1.1', 'http/1.0'], 
                            rejectUnauthorized: false, 
                            socket: soc, 
                            host: (this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com", 
                            port: this.options.port,
                            agent: false, 
                            servername: (this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com", 
                            echdCurve: "GREASE:X25519", 
                            ciphers: this.options.ciphers
                        }, () => {
                            this.socket = socket

                            if(this.socket.alpnProtocol == 'h2') {
                                this.options["headers"] = this.reorderHttp2Headers(options);
                            } else {
                                this.options["headers"] = this.reorderHttpHeaders(options)
                            }

                        })

                        const client = http2.connect(this.options.url, {
                            createConnection: () => socket
                        });

                        resolve(client)
                    });

                } else {

                    /* create socket */
                    const socket = tls.connect({
                        ALPNProtocols: ['h2', 'http/1.1', 'http/1.0'],
                        rejectUnauthorized: false,
                        host: (this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com",
                        port: this.options.port,
                        servername: (this.options.Host) ? this.options.Host.substring(this.options.Host.indexOf(".") + 1) : "domain.com",
                        echdCurve: "GREASE:X25519",
                        ciphers: this.options.ciphers,
                        timeout: this.options.timeout
                    }, () => {
                        this.socket = socket;

                        const client = http2.connect(this.options.url, {
                            createConnection: () => socket
                        }, () => {});

                        resolve(client)
                    })
                } 

            } catch (error) {
                reject(error);
            } 
        })
    }

    makeRequest() {
        return new Promise(async (resolve, reject) => {
            try {

                this.options = this.buildRequest(this.options);

                if (!this.options.headers["cookie"]) {
                    request.jar().getCookieString(this.options.url, (error, cookie) => {
                        if (error) throw new Error(error);
                        if (cookie && cookie.length > 0) this.options.headers["cookie"] = cookie;
                    })
                }

                const client = await this.buildClient(this.options);

                if(this.options.connect){
                    this.options.headers["connection"] = "keep-alive"
                }

                if (["POST", "PATCH", "PUT"].includes(this.options.method)) {
                    if (this.options.form) {
                        this.options.body = querystring.stringify(this.options.form);
                        this.options.headers["content-type"] = this.options.headers["content-type"] ? this.options.headers["content-type"] : "application/x-www-form-urlencoded";
                    } else if (this.options.json && !ErrorHandler.isUndefined(this.options.body)) {
                        this.options.body = new Buffer.from(JSON.stringify(this.options.body));
                        this.options.headers["content-type"] = this.options.headers["content-type"] ? this.options.headers["content-type"] : "application/json";
                    }
                    this.options.headers["content-length"] = (this.options.body) ? this.options.body.length : 0;
                }
                this.options.headers["origin"] ? this.options.headers["origin"] : this.options.origin;
                this.options.headers = this.reorderHttp2Headers(this.options);

                let req = client.request(this.options.headers);

                req.on('socket', (socket) => {
                    let timeout = (this.options.timeout) ? this.options.timeout : 15000
                    socket.setTimeout(timeout);
                    socket.on('timeout', () => {
                        req.abort()
                    })
                })

                if (["POST", "PATCH", "PUT"].includes(this.options.method)) {
                    if (this.options.debug) console.log(this.options.body)
                    if (this.options.headers["content-length"] > 0) req.write(this.options.body);
                    req.end();
                } else {
                    req.end();
                };

                req.once('drain', function () {
                    console.log('drain', arguments);
                });

                req.once("response", async (response) => {
                    if (!response) {
                        throw new Error("Error completing request")
                    }

                    if (this.socket.alpnProtocol === "h2") {

                        let res = { _headers: this.options.headers, headers: response, statusCode: response[":status"], data: [], url: this.options.url, httpVersion: client.version };
                        req.on('data', function (chunk) {
                            if(chunk)
                            res.data.push(chunk);
                        });

                        req.once('end', () => Promise.all([this.decodeReseponse(res)]).then(() => {
                            this.socket.destroy();

                            if(!ErrorHandler.isHTTPError({statusCode: res.statusCode})){
                                 resolve(res) 
                            } else {
                                reject({
                                    response: `Bad response code ${res.statusCode}`,
                                    status: res.statusCode,
                                    headers: res.headers,
                                    body: res.body
                                });
                            }

                        }));
                    } else {
                        let res = { _headers: this.options.headers, headers: response.headers, data: [], url: this.options.url, httpVersion: client.version };
                        req.on('data', function (chunk) {
                            if(chunk)
                            res.data.push(chunk);
                        });
                        req.once('end', () => Promise.all([this.decodeReseponse(res)]).then(() => {
                            this.socket.destroy();

                            if(!ErrorHandler.isHTTPError({statusCode: res.statusCode})){
                                 resolve(res) 
                            } else {
                                reject({
                                    response: `Bad response code ${res.statusCode}`,
                                    status: res.statusCode,
                                    headers: res.headers,
                                    body: res.body
                                });
                            }

                        }));
                    }
                });

                req.once('timeout', () => {
                    console.log(`Timeout Error`);
                    reject(`Timeout Error`)
                });

                req.once("error", function (err) {
                    console.log(err);
                    reject(err)
                });

            } catch (error) {
                if(this.socket) {
                    this.socket.destroy();
                };

                reject({
                    response: error.message,
                    status: 0,
                    headers: this.options.headers
                });
            }
        })
    }

}

module.exports = H2Wrapper;