module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: [
    'plugin:vue/essential',
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    parser: '@babel/eslint-parser'
  },
  rules: {
    // 可添加自定义规则
  }
}