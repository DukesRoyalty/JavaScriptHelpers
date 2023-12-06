const cookieHelper = {};
const errorHandler = require("./error-service")();

cookieHelper.formatCookies = (cookies) => {
    return cookies.map(cookie => 
        cookie = {
            url: this.siteHost,
            name: cookie.split("=")[0],
            value: cookie.split("=")[1],
            domain: this.siteHost,
            expirationDate: 0 
        }
    )
};

cookieHelper.setCookie = async (cookie, jar, site) => {
    if (errorHandler.isUndefined(cookie)) return;
    jar.setCookie(cookie, site, (error, cookie) => {
        if (error) {
            return new Error(`Error setting cookie, ${cookie}`, error);
        };
    });
};

cookieHelper.setCookies = async (cookies, jar, site) => {
    if (errorHandler.isEmptyArray(cookies)) return;
    return cookies.forEach(async cookie => {
        await cookieHelper.setCookie(cookie, jar, site);
    });
};

cookieHelper.getCookies = async (jar, site) => {
    return await (jar.getCookieString(site)).split(";");
};

cookieHelper.addCookies = (headers, cookies) => {
    if (headers['Cookie'] == '') {
        headers['Cookie'] = cookies.join(";")
    } else {
        headers['Cookie'] = headers['Cookie'] + ";" + cookies.join(";")
    };

    return headers;
};

cookieHelper.getCookie = (response, name, jar, site) => {
    var cookie;
    if(response) {
        cookie = response.headers['set-cookie'].filter(cook => cook.indexOf(name) != -1)[0];
    } else {
        cookie = (jar._jar.store.idx[site.split(".")[1] + ".com"]['/'][name]).toString();
    }
    cookie = cookie.split("=")[1];
    return cookie.split(";")[0];
};

cookieHelper.hasCookie = (response, name) => {
    if(response && response.body && response.body.headers) {
        if(Array.isArray(response.body.headers)) {
            response.body.headers = response.body.headers[0];
        }
        if(response.body.headers["set-cookie"] && response.body.headers["set-cookie"].length  > 0) {
            return response.body.headers["set-cookie"].some(cookie => cookie.toString().includes(name))
        }
    };
    return false;
};

cookieHelper.jarHasCookie = async (jar, site, name) => {
    let cookies = await cookieHelper.getCookies(jar, site);
    return cookies.some(cookie => cookie.toString().includes(name));
};

cookieHelper.removeFromJar = (jar, site, name) => {
   delete jar._jar.store.idx[site.split(".")[1] + ".com"]['/'][name];
   return jar;
};

module.exports = cookieHelper;