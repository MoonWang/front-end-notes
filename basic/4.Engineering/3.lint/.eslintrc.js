/* eslint-disable */
/**
 * 用法说明：
 *  1. 安装
 *      - npm包
 *          - npm install -g eslint  // 全局安装
 *      - IDE插件
 *          - vscode
 *              - ESLint
 *              - 添加配置 "eslint.autoFixOnSave": true 实现保存自动修复
 *          - atom
 *              - linter、linter-eslint
 *              - inter-eslint 按需勾选 Fix errors on save 实现保存自动修复
 *          - sublime
 *              - SublimeLinter、SublimeLinter-eslint、ESLint Formatter
 *              - ESLint Formatter 插件增加 "format_on_save": true 实现保存自动修复
 *          - webstorm
 *              - Webstorm -> Preferences（或File -> setting）-> 搜索 eslint，勾选 Enable，设置 config 文件目录
 *  2. 使用
 *      - 脚本
 *          - eslint ./ --fix       // --fix 表示自动修复部分问题
 *          - eslint lib/**
 *          - eslint file1.js file2.js
 *      - js脚本中部分禁用规则
 *          - \/* eslint-disable *\/    // 在部分不需要的文件顶部写入该注释
 *          - \/* eslint-enable *\/     // 在结束禁用的地方写入该注释，配和上一条实现一段代码禁用检查
 *          - // eslint-disable-next-line // 禁止下一行被检查
*/
module.exports = {
    "root": true,       // 不再向上查找
    "extends": 'eslint:recommended',  // 启用推荐规则
    "env": {
        'browser': true,// 浏览器环境
        'amd': true,    // 将 require() 和 define() 定义为像 amd 一样的全局变量
        'jquery': true, // jQuery 全局变量
    },
    "rules": {          // 0-关闭、1-警告、2-报错
        'no-console': 0,        // 不使用console
        'no-unused-vars': [     // 禁止出现未使用过的变量
            "error",
            {
               // "varsIgnorePattern": "",   // 设置忽略项，变量名称匹配正则模式
                "args": "none", // 忽略函数参数使用情况，为了module不报错，其他函数也受到影响，待定
            }
        ],
        'semi': 2,              // 末尾使用分号
        'no-multiple-empty-lines': [
            'error',
            { 'max': 2, 'maxEOF': 1 }   //  (默认为 2) 强制最大连续空行数，强制文件末尾的最大连续空行数1
        ], // 禁止出现多行空行
        'no-mixed-spaces-and-tabs': [ // 禁止空格和 tab 的混合缩进
            0,                // 暂时关闭
            "smart-tabs"        // 当 tab 是为了对齐，允许混合使用空格和 tab。
        ],
        'no-empty': [
            "error",
            { "allowEmptyCatch": true } // 允许出现空的 catch 子句 (也就是说，不包含注释)
        ],
        'valid-typeof': [
            'error', //"undefined"、"object"、"boolean"、"number"、"string"、"function"、"symbol"
            { "requireStringLiterals": true }   // 要求 typeof 表达式只与字符串字面量或其它 typeof 表达式 进行比较，禁止与其它值进行比较。
        ],
        'no-debugger': 1,   // 本地可以设为0，方便debug
        'no-fallthrough': [
            "error", 
            { "commentPattern": "break[\\s\\w]*omitted" }   // 通过 // break omitted 来省略break
        ]
    },
    "globals": {        // 全局变量声明
        "moon": true
    }
};
