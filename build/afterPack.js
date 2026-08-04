// 打包后钩子：裁剪 Electron 语言包，只保留常用语言，减小安装体积
const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  const localesDir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return

  const keep = new Set(['en-US.pak', 'zh-CN.pak', 'zh-TW.pak', 'ja.pak', 'ko.pak'])
  let removed = 0
  for (const file of fs.readdirSync(localesDir)) {
    if (!keep.has(file)) {
      fs.unlinkSync(path.join(localesDir, file))
      removed++
    }
  }
  console.log(`[afterPack] locales: removed ${removed} files, kept ${keep.size}`)
}
