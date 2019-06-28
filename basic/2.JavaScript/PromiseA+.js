/**
 * Promise/A+ 规范译文：https://segmentfault.com/a/1190000002452115
 */
function Promise(executor) {
    let self = this;
    // 缓存状态，只能从 pending 到 fulfilled 或 rejected，改变了就不能再变化
    self.status = "pending";
    // 缓存结果、错误原因（reason 没有单独处理，可以和 value 合并成一个变量）
    self.value = undefined;
    // 缓存回调
    self.onResolvedCallbacks = [];
    self.onRejectedCallbacks = [];

    // 解决（成功）的执行方法
    function resolve(value) {
        // 支持 resolve 一个 promise 
        if (value instanceof Promise) {
            return value.then(resolve, reject)
        }

        // 异步执行所有的回调函数
        setTimeout(function () { 
            // 只有 pending 状态下才能执行改变
            if (self.status == 'pending') {
                // 保存结果，成功后每次取到的都是同一个结果
                self.value = value;
                // 更新状态值
                self.status = 'resolved';
                // 遍历执行成功回调
                self.onResolvedCallbacks.forEach(item => item(value));
            }
        });

    }

    // 拒绝（失败）的执行方法
    function reject(value) {
        setTimeout(function () {
            if (self.status == 'pending') {
                self.value = value;
                self.status = 'rejected';
                self.onRejectedCallbacks.forEach(item => item(value));
            }
        });
    }

    try {
        // 立即执行，需要提供两个方法给执行函数
        executor(resolve, reject);
    } catch (e) {
        // catch 执行错误
        reject(e);
    }
}

// Promise 解析过程，满足
function resolvePromise(promise2, x, resolve, reject) {
    // promise 执行不能返回自己，会死循环
    if (promise2 === x) {
        return reject(new TypeError('循环引用'));
    }

    // called：只第一次有效，后面的忽略
    let then, called;

    if (x != null && ((typeof x == 'object' || typeof x == 'function'))) {
        // 如果 x 是一个对象或一个函数
        try {
            then = x.then;
            if (typeof then == 'function') {
                // 如果 then 是一个函数，以 x 为 this 调用 then 函数
                // 第一个参数是 resolvePromise，第二个参数是rejectPromise
                then.call(x, function (y) {
                    if (called) return;
                    called = true;
                    // 继续递归
                    resolvePromise(promise2, y, resolve, reject);
                }, function (r) {
                    if (called) return;
                    called = true;
                    // 直接拒绝
                    reject(r);
                });
            } else {
                // 如果 then 不是一个函数，则以 x 为值 fulfill promise。
                resolve(x);
            }
        } catch (e) {
            if (called) return;
            called = true;
            // 如果抛出了异常，则以这个异常做为原因将 promise 拒绝
            reject(e);
        }
    } else {
        // 其他情况直接以 x 为值 fulfill promise
        resolve(x);
    }
}
Promise.prototype.then = function (onFulfilled, onRejected) {
    let self = this;
    // 参数非函数的情况，忽略，并将上一步结果直接返回，继续向下传
    onFulfilled = typeof onFulfilled == 'function' ? onFulfilled : function (value) {
        return value
    };
    // 同上，替换为抛错方法
    onRejected = typeof onRejected == 'function' ? onRejected : function (value) {
        throw value
    };

    // then 必须返回一个 promise
    let promise2;
    // 已经是解决状态，则直接调用 onFulfilled
    if (self.status == 'resolved') {
        promise2 = new Promise(function (resolve, reject) {
            setTimeout(function () {
                try {
                    let x = onFulfilled(self.value);
                    // 递归获取最终状态
                    resolvePromise(promise2, x, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });

        });
    }
    // 已经是拒绝状态，则直接调用 onRejected
    if (self.status == 'rejected') {
        promise2 = new Promise(function (resolve, reject) {
            setTimeout(function () {
                try {
                    let x = onRejected(self.value);
                    resolvePromise(promise2, x, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
    // 进行中状态下，需要先缓存回调
    if (self.status == 'pending') {
        promise2 = new Promise(function (resolve, reject) {
            self.onResolvedCallbacks.push(function (value) {
                try {
                    let x = onFulfilled(value);
                    resolvePromise(promise2, x, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });
            self.onRejectedCallbacks.push(function (value) {
                try {
                    let x = onRejected(value);
                    resolvePromise(promise2, x, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
    // then 必须返回一个 promise
    return promise2;
}

// catch 是只有参数2的 then
Promise.prototype.catch = function (onRejected) {
    return this.then(null, onRejected);
}

// all 需要全部状态 fulfilled
Promise.all = function (promises) {
    return new Promise(function (resolve, reject) {
        let result = [];
        let count = 0;
        for (let i = 0; i < promises.length; i++) {
            promises[i].then(function (data) {
                result[i] = data;
                if (++count == promises.length) {
                    resolve(result);
                }
            }, function (err) {
                reject(err);
            });
        }
    });
}

// 测试用例用的
Promise.deferred = Promise.defer = function () {
    var defer = {};
    defer.promise = new Promise(function (resolve, reject) {
        defer.resolve = resolve;
        defer.reject = reject;
    })
    return defer;
}
/**
 * npm i -g promises-aplus-tests
 * promises-aplus-tests Promise.js
 */
try {
    module.exports = Promise
} catch (e) {}