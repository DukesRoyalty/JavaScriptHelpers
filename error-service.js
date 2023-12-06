const logger = require('./logger-service');

class CustomError extends Error {  
    constructor (message, code, body) {
      super(message)
  
      // assign the error class name in your custom error (as a shortcut)
      this.name = this.constructor.name
  
      // capturing the stack trace keeps the reference to your error class
      Error.captureStackTrace(this, this.constructor);
  
      // you may also assign additional properties to your error
      this.status = code;
      this.response = message;
      this.body = body;
    }
}

module.exports = () => {
    const isUndefined = (value) => {
        return typeof value === "undefined" || value === null || value === ""
    };

    const isEmptyArray = (value) => {
        return !isUndefined(value) && Array.isArray(value) && value.length === 0
    };

    const isObject = (value) => {
        return !isUndefined(value) && value === Object(value) && Object.keys(value).length > 0
    };

    const isEmptyObject = (value) => {
        return !isUndefined(value) && value === Object(value) && Object.keys(value).length === 0
    };

    const isObjectContains = (obj, value) => {
        return !isUndefined(obj) && obj === Object(obj) && Object.keys(obj).map(item => item = item.toLowerCase()).indexOf(value) > -1
    };

    const isError = (value) => {
        return value instanceof Error || isUndefined(value);
    }

    const isHTTPError = (value) => {
        return isUndefined(value) || `${value.statusCode}`[0] == '3' ||  `${value.statusCode}`[0] == '4' ||  `${value.statusCode}`[0] == '5'
    }

    const errorResponseHandler = async (taskId, taskType, message, duration, timeout) => {
        logger(taskType, taskId).red(message, duration);
        await delay(timeout);
    }

    const customError = (message, code, body, bool) => {
        if(bool) {
            throw new CustomError(message, code, body);
        }
        return new CustomError(message, code, body);
    }

    return Object.freeze(
        {
            isUndefined,
            isEmptyArray,
            isObject,
            isEmptyObject,
            isObjectContains,
            isError,
            isHTTPError,
            errorResponseHandler,
            customError
        }
    );
};

const delay = async (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    });
};