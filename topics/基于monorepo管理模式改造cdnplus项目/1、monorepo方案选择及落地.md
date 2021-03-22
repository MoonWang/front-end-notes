# 一、背景说明

随着自研 CDN 的发展，部分功能复杂或特殊的子产品需要提供独立的客户控制台，随着新产品的不断开发，控制台数量也会不断增多。目前采用的代码管理方式为 **Multirepo** ，即`各个子项目分别维护于独立的仓库`。但是各项目之间存在很多可以复用的东西，如业务组件、页面布局、工具链等。**随着业务发展的发展，项目体量增大，子产品的数量持续增多，上述管理方式使得各项目的维护管理变得复杂和麻烦，难以满足现状需求**。主要体现在以下几个方面：

1. 代码复用
    - 不同仓库无法合理复用通用业务组件、布局组件等内容
    - 当出现通用需求调整时，需要维护多份，重复工作量倍增
2. 工具链复用
    - 升级工具链时，需要逐一操作调试，重复工作
3. 依赖管理
    - 各仓库的依赖包版本无法确保一致，项目的稳定性面临冲击

我们需要寻找合适的方案，帮助开发人员减少因项目间的差异带来的沟通成本及重复作业，将精力聚集在具体业务上，提高工作效率。一个理想的开发环境可以抽象成这样：**“只关心业务代码，可以直接跨业务复用而不关心复用方式，调试时所有代码都在源码中。”**

# 二、方案选择

最初有考虑拆分 `ESM` 子项目或 `Git Submodules` 子仓库来解决问题，但由于各产品仓库强依赖公共模块仓库，当公共模块升级时，各产品仓库需要手动升级，不仅低效且容易出现疏漏，开发调试时也并不友好。故这两种方案都不能很好的满足整体需求。

后面参考业界方案并结合项目现状，选择使用 **Monorepo** 的模式管理代码，即`多个子项目（package）在同一个仓库中维护`。目前有不少大型开源项目采用了这种模式来管理代码。关于该模式带来的问题：repo 体积增大和子项目的权限管理，在当前项目中表现也并不明显。

目前业界知名度最高的两种 Monorepo 管理方案分别是：`Lerna + Yarn workspace`  和 `pnpm`。考虑 pnpm 特有的依赖管理方式带来的包安装速度、包安全性上的提升，从 npm/yarn 迁移到 pnpm 的学习成本低，最终选择采用 **pnpm** 作为解决方案。（更多了解可查看最后的参考文章）

# 三、方案落地

## 1、引入 pnpm

### 1.1 全局安装

```bash
$ npm i -g pnpm
```

### 1.2 配置 pnpm-workspace.yaml

workspace 是 pnpm 支持 monorepo 的基础，它允许我们像依赖一个 npm 包那样去依赖一个子目录（子项目）。

默认情况下，当正确配置依赖声明时（name: version 都匹配），pnpm 会从工作区内去链接对应的包（当前仓库下的指定子目录），否则会走正常依赖安装步骤。

此外，pnpm 也支持 `workspace:` 协议（和 yarn v2 相同），作为依赖包声明的 version 字段前缀，用于约束该依赖必须来资源本地的 workspace 下的子项目。

在仓库根目录下创建 pnpm-workspace.yaml 文件，定义 workspace 包含/排除的目录。

```yaml
packages:
  - packages/*
```

### 1.3 调整目录结构

#### 1.3.1 目录结构

得益于各产品子项目的常规依赖基本一致，并没有用到 pnpm 的依赖提升功能，而是选择根目录下管理所有常规依赖，各产品子项目仅管理自身对 workspace 公共子项目的依赖。

```js
cdnplus-web      
├─ packages			# 存放所有子项目
│  ├─ autoform			# 自动表单（公共子项目一）
│  │  ├─ src  
│  │  │  └─ ...  
│  │  └─ package.json		
│  ├─ common			# 通用代码（公共子项目二）
│  │  ├─ ...			   # 子目录层级和各 cdn 项目 src 目录完全一致（特殊）
│  │  └─ package.json	
│  ├─ cdn				# 某 cdn 产品子项目        
│  │  ├─ src            
│  │  │  └─ ...                        
│  │  └─ package.json		# 声明公共子项目依赖                    
│  ├─ ... 				# 其他 cdn                
├─ package.json			# 声明全局依赖                       
└─ pnpm-workspace.yaml                       
```

#### 1.3.1 定义公共子项目

根据项目现状，提取2个公共子项目：common 和 autoform，分别配置如下：

- packages/common/package.json

```json
{
    "name": "@cdnplus/common",
    "version": "0.1.0",
    "private": true
}
```

- packages/autofrom/package.json

```json
{
    "name": "@cdnplus/autoform",
    "version": "0.1.0",
    "private": true,
    "dependencies": {
        "@cdnplus/common": "workspace:*"
    }
}
```

注意：公共子项目 common 在各个产品子项目均有使用，建议在使用时做好隔离，特定产品需求不能满足时，先在该产品子项目内进行升级验证，稳定运行后再评审是否需要提升到 common 中。

#### 1.3.3 使用公共子项目

产品子项目使用公共子项目时，配置如下（以 cdn 为例）：

- packages/cdn/package.json（`workspace:*` 表示当前版本）

```json
{
    "name": "cdn",
    "version": "1.3.0",
    "dependencies": {
        "@cdnplus/common": "workspace:*",
        "@cdnplus/autoform": "workspace:*"
    }
}
```

- 安装

```bash
# 根目录下执行
$ pnpm i
```

- 使用

```ts
import * as CommonUtils from "@cdnplus/common/utils";
import OrderformEt from "@cdnplus/autoform/src";
```

### 1.4 其他

#### 1.4.1 显式声明依赖

由于 pnpm 的依赖管理策略在确保安全性时，阻止了`幻影依赖（Phantom dependency）`的发生，所以需要把代码中需要用到的依赖都改为显式声明。

#### 1.4.2 仅允许 pnpm 

为了防止开发人员意外运行 `npm i` 或 `yarn`，通过在 package.json 中增加下列脚本解决。

```json
{
    "scripts": {
        "preinstall": "npx only-allow pnpm"
    }
}
```

#### 1.4.3 指定版本

由于部分功能依赖了 pnpm 的高版本，进而也对 node 版本有所要求，为保障正常运行需要在 package.json 中增加版本约束。

```json
{
    "engines": {
        "node": ">=10",
        "pnpm": ">=5"
    }
}
```



## 2、工具链改造

工具链的改造主要是为了满足便捷复用，分为两种：全局应用、通过环境变量实现局部应用。

其中 eslint、typescript、babel、prettier 等配置文件保持放在根目录下即可。

### 2.1 开发配置

#### 2.1.1 package.json

调整开发脚本，使用 `cross-env` 包设置环境变量，用于支持后续的工具扩展

```bash
$ pnpm i -D cross-env
```

```json
{
    "scripts": {
    	"serve:cdn": "cross-env PKG_NAME=cdn vue-cli-service serve --open"
    }
}
```

#### 2.1.2 vue.config.js

需要调整的配置：

- 项目入口
- html 模板
- 全局变量
- 路径别名（非必须）
- scss-loader 配置 prependData

```js
const package = process.env.PKG_NAME;

module.exports = {
    chainWebpack: config => {
        // 根据入口改变 entry
        config
            .entry("app")
            .clear()
            .add(`./packages/${package}/src/main.ts`);

        // 根据入口改变 template
        config.plugin("html").tap(args => {
            Object.assign(args[0], {
                title: `${package} 控制台`,
                // 此时 public 仍放在根目录下，改为通用模板
                template: `./public/index.html`,
                favicon: `./public/favicon.ico`,
                // 其他非标参数，通过 <%= htmlWebpackPlugin.options.layoutCSS %> 使用
                layoutCSS: `/${package}/ctyun/layoutStyle`,
                layoutJs: `/${package}/ctyun/layoutScript`,
            });
            return args;
        });

        // 声明全局变量
        config.plugin("define").tap(args => {
            Object.assign(args[0]["process.env"], {
                // 用于支持在公用代码中实现定制化处理
                PKG_NAME: JSON.stringify(package),
            });
            return args;
        });
    },
    configureWebpack: () => {
        const result = {
            resolve: {
                alias: {
                    // @ 路径别名虽仍存在，但不再适用，按照资项目名称提供语义化别名
                    // 同时动态配置别名，可以约束 cdn-a 项目直接引用 @cdn-b/ 的错误用法
                    [`@${package}`]: path.resolve(__dirname, `packages/${package}/src`),
                },
            },
        };
        return result;
    },
    css: {
        extract: isProduction,
        sourceMap: false,
        loaderOptions: {
            scss: {
                prependData: `@import "@${package}/assets/css/_index.scss";`,
            },
        },
    },
};
```

#### 2.1.3 tsconfig.json

```json
{
    "compilerOptions": {
        "baseUrl": "./packages",
        "paths": {
            "@cdn/*": [
                "cdn/src/*"
            ],
            ...
        },
    }
}
```

### 2.2 发布配置

#### 2.2.1 package.json

```json
{
    "scripts": {
    	"build:cdn": "cross-env PKG_NAME=cdn vue-cli-service build"
    }
}
```

#### 2.2.2 vue.config.js

```JS
const package = process.env.PKG_NAME;

module.exports = {
    outputDir: `./packages/${package}/dist`,
}
```

#### 2.2.3 remote.build.sh

该脚本用于执行前端远端打包的需求，具体的说明可查看[基于docker+gogs+drone实现CI/CD](./2、基于 docker + gogs + drone 实现 CICD.md)。该脚本为实现通用，需要做如下调整：

- 项目名改为由 drone 中设置的环境变量传入
- 数据持久化调整，dist 和 last-commit-hash 需要根据产品分别存储
- 由于存在 workspace 子项目依赖， pnpm i 需要在每次构建前执行
- diff 判断 src 目录内容是否改变时，需要同时判断 autoform/src、common、当前产品子项目下的 src 是否改变

```sh
# 获取环境变量
PKG_NAME=${PKG_NAME}

# 检测并确保当前项目的主缓存目录存在
[ -d /tmp/cache/$PKG_NAME ] || mkdir -p /tmp/cache/$PKG_NAME

# 判断 src 是否有改变
git diff HEAD $last_commit_hash ./packages/common | grep -E 'diff'
git diff HEAD $last_commit_hash ./packages/autoform/src | grep -E 'diff'
git diff HEAD $last_commit_hash ./packages/$PKG_NAME/src | grep -E 'diff'

# 安装 pnpm 并执行构建
npm i -g pnpm
pnpm i --unsafe-perm || error_exit "** pnpm install failed **"

# 缓存 dist 目录
[ -d /tmp/cache/dist ] || mkdir -p /tmp/cache/dist
cp -rf ./packages/$PKG_NAME/dist /tmp/cache/$PKG_NAME

# 缓存 last-commit-hash
echo `git rev-parse HEAD` > /tmp/cache/$PKG_NAME/last-commit-hash

```

#### 2.2.4 Dockerfile

该文件用于打包前端项目 docker 镜像，为满足通用，修改为变量指定工作目录

```dockerfile
# 通过环境变量 $PKG_NAME 指定目标路径，便于扩展
ARG PKG_NAME
# 执行目录创建的命令
RUN mkdir -p /www/h5/${PKG_NAME}
# 指定工作目录（必须提前创建）
WORKDIR /www/h5/$PKG_NAME
# 复制 dist 目录
ADD packages/$PKG_NAME/dist /www/h5/$PKG_NAME

```

#### 2.2.5 .drone.k8s.yaml

改文件用于部署开发环境，涉及 `cdnplus-web-cdn` 的内容均改为 `cdnplus-web-${PKG_NAME}` 即可。

#### 2.2.5 .drone.yml

需要在各 steps 中配置环境变量或命令行参数，用于支持各脚本通用。（示例只体现了修改部分，其他配置不变）

```yaml
---
kind: pipeline
type: docker
name: cdnplus-web
steps:
    - name: build-cdn
      environment:
        PKG_NAME: cdn # 配置环境变量，指定 remote.build 远程打包时的项目路径
      commands:
        - /bin/sh ./scripts/remote.build.sh # 调用仓库中的脚本
    - name: docker-cdn
      settings:
          repo: harbor.ctyuncdn.cn/cdnplus-dev/cdnplus-web-cdn # 指定镜像推送地址
          build_args:   # 设置镜像创建时的变量，即 Docker build 命令中 --build-arg 参数
              - PKG_NAME=cdn # 配置 docker 镜像内的环境变量，指定构建镜像时的路径
          dockerfile: Dockerfile # 调用仓库根目录下的 Dockerfile
    - name: deploy-cdn
      environment:
        PKG_NAME: cdn # 配置环境变量，指定 k8s 发布时的项目名称
      commands:
          - envsubst < .drone.k8s.yaml > k8s.yaml # 调用仓库根目录下的 .drone.k8s.yaml
          - kubectl apply -f k8s.yaml

```

#### 2.2.6 jenkinsfile

需要在各 stage.steps 中修改配置文件，替换占位符，用于支持各配置文件通用。

```jenkinsfile
pipeline {
	...
    environment {
        PKG_NAME_CDN = "cdn"
    }
	stages {
		stage("deploy-cdn") {
			steps {
				// 替换占位，不能直接用环境变量获取，配置文件中使用 {{PKG_NAME}} 占位
				sh """
					sed -i 's#{{PKG_NAME}}#'$PKG_NAME_CDN'#g' deploy.yaml service.yaml
				"""
                        
				script {
					container('tools') {
						// create configmap and ingress
					}
				}
			}
		}
	}
}

```

#### 2.2.7 条件执行

- drone ：考虑通过 branch name 进行约束（分支名以迭代序号开始）

```yaml
kind: pipeline
type: docker
name: cdnplus-web
steps:
    - name: build-cdn
      when:
        branch: # glob 匹配模式
          - sprint[1-9][0-9]        # 支持无后缀（通用）
          - sprint[1-9][0-9]-cdn   	# 支持指定后缀（定制）

```



- jenkins ：考虑通过发布时的 tag 进行约束

```jenkinsfile
pipeline {
	...
	environment {
        // 执行条件（通用）
        QA_TAG = "v\\d+\\.\\d+.\\d+(-rc\\d+)?" // v1.0.0-rc01 
        // 执行条件（定制）
        QA_TAG_CDN = "v\\d+\\.\\d+.\\d+-cdn(-rc\\d+)?" // v1.0.0-${PKG_NAME}-rc01
    }
	stages {
		stage("deploy-cdn") {
        	when {
                expression { TAG_NAME ==~ env.QA_TAG || TAG_NAME ==~ env.QA_TAG_CDN }
            }
            ...
        }
	}
}

```



# 参考

- [node_modules 困境](https://juejin.cn/post/6914508615969669127#heading-24)
- [为什么现在我更推荐 pnpm 而不是 npm/yarn?](https://mp.weixin.qq.com/s/2LJmkcNfH9MHp597xjdIyQ)
- [pnpm 官方文档](https://pnpm.js.org/motivation)