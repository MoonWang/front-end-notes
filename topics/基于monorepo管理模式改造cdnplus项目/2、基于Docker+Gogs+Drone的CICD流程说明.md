# 一、简易版流程

1. 代码 push 到 Gogs 仓库，通过触发 Web hooks  来通知 Drone 
2. Drone 开始 clone 仓库
3. Drone 开始执行配置文件中的 pipeline （根目录下的 `.drone.yml` ）
    1. build ，执行 remote.build.sh 自定义脚本，完成前端构建，输出 dist 目录
    2. docker ，执行 docker build -f Dockerfile ，构建 nginx 镜像（使用前面输出的 dist ），并推送到 Harbor 仓库
    3. deploy ，执行 kubectl apply -f k8s.yaml ，完成部署（使用前面输出到 Harbor 的镜像）

# 二、YAML 基础

YAML 是专门用来写配置文件的语言，比 JSON 更方便，本质上是一种通用的数据串行化格式。上述流程中的配置文件 `.drone.yml` 和 `.k8s.yml` 均使用 YAML 语言编写。

## 1、语法规则

- 大小写敏感
- 使用缩进表示层级关系
- 缩进时不允许使用Tal键，只允许使用空格
- 缩进的空格数目不重要，只要相同层级的元素左侧对齐即可
- ”#” 表示注释，从这个字符一直到行尾，都会被解析器忽略　

## 2、YAML Maps

两种结构类型之一，是 `key:value` 键值对。value 既可以是字符串，也可以是一个 Maps 。

例子：

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cdnplus
  labels:
    app: cdnplus-web
```

转换成 JSON ：

```json
{
  "apiVersion": "v1",
  "kind": "Namespace",
  "metadata": {
    "name": "cdnplus",
    "labels": {
      "app": "cdnplus-web"
    }
  }
}
```

## 3、YAML Lists

两种结构类型之二，是数组。

例子：

```yaml
args:
 - beijing
 - guangzhou
```

转换成 JSON ：

```json
{
  "args": [
    "beijing",
    "guangzhou"
  ]
}
```

当然 Lists 的子项可以是 Maps，Maps 的子项也可以是 Lists ，示例：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cdnplus-web
  namespace: cdnplus
  labels:
    app: cdnplus-web
spec:
  restartPolicy: Always
  containers:
    - name: cdnplus-nginx
      image: nginx
      ports:
        - containerPort: 80
      resources:
        requests:
          memory: "512Mi"
          cpu: "500m"
```

转换成 JSON ：

```json
{
  "apiVersion": "apps/v1",
  "kind": "Deployment",
  "metadata": {
    "name": "cdnplus-web",
    "namespace": "cdnplus",
    "labels": {
      "app": "cdnplus-web"
    }
  },
  "spec": {
    "restartPolicy": "Always",
    "containers": [
      {
        "name": "cdnplus-nginx",
        "image": "nginx",
        "ports": [
          {
            "containerPort": 80
          }
        ],
        "resources": {
          "requests": {
            "memory": "512Mi",
            "cpu": "500m"
          }
        }
      }
    ]
  }
}
```

# 三、 Drone 说明

Drone 是基于 go 的 CI/CD 解决方案。相对于 Jnekins 来说，Drone pipeline 好处是相对更轻量级，YAML 定义也相对简洁清晰，按照功能来划分容器，可以方便的实现 task 的复用。

| 对比项        | jenkins                      | drone                                                     |
| ------------- | ---------------------------- | --------------------------------------------------------- |
| pipeline 定义 | 编写 jenkinsfile             | 编写流程 .drone.yml                                       |
| 运行方式      | 在一个 pod 里运行            | 每一步骤起对应的 container ，通过挂载 volume 实现数据共享 |
| 运行环境      | 物理机或者容器环境，包括 K8S | docker 容器环境                                           |
| 开发语言      | java                         | golang                                                    |

## 1、常用配置项说明

### 1.1 steps

Pipeline steps 被定义为一系列的 shell 命令。这些命令在 git 仓库的根目录中执行。git 仓库的 root （或者叫 workspace）在 Pipeline  的所有步骤中共享，因此我们可以**跨步骤访问这些文件**。

#### 1.1.1 commands

可以指定当前步骤需要执行的命令，会被解析成 shell 脚本，然后这个脚本会被当做 docker 的入口点执行。

#### 1.1.2 environment

可以定义环境变量，范围为当前 step 。

#### 1.1.1 plugins

封装了命令的 Docker 容器在这里就是 plugin ，主要用途是为了封装特定的逻辑。（如果此时声明了 commands 会导致当前步骤的镜像内封装的命令不执行）

#### 1.1.1 conditions / when

可以定义当前步骤的执行条件，条件可以为 `branch、event、ref、repo、target、instance、status` 等。

需要注意的时候，条件用到是 `glob 匹配模式`，并非正则匹配。

### 1.2 image

Pipeline steps 定义为一系列 Docker 容器。因此，每个步骤都必须定义用于创建容器的 Docker 镜像。

#### 1.2.1 pull

 `pull` ：if-not-exists | always | never 

释义：如果本地缓存中未找到镜像再拉取 | 始终拉取最新 | 从不拉取（使用本地缓存）

### 1.3 volumes

#### 1.3.1 Host Volumes

用于挂载宿主机数据卷，pipeline  各步骤都能使用。常用于数据持久化。

1. 定义宿主机数据卷路径（绝对路径）
2. 配置 step 中容器路径（绝对路径），通过 name 关联

#### 1.3.2 Temporary Volumes 

用于挂载临时数据卷，在 pipeline  启动之前创建并在 pipeline  完成时销毁，可用于在各步骤之间共享文件或文件夹。

# 三、前端构建

由于在前端构建时，项目依赖存储于开发人员个人机器中，这不可避免的会出现因`本地缓存、npm 依赖版本差异`而影响输出的稳定性。因此产生了在服务器中执行远端构建的诉求。在项目前期，因 jenkins 发布机无法访问 npm 私服，无法实现远端构建的目标，也因此引发了不少问题。在新的 CI/CD 流程中，Drone 和 npm 私服部署在一起，访问限制不复存在，为我们实现远端构建提供了支持。

## 1、基础实现

```yaml
steps:
    - name: build-scdn
      image: node
      commands:
      	# npm 不支持 root 用户运行，会默认转为 nobody 运行（几乎没权限）而报错，需要 `unsafe-perm` 参数
        - npm i --unsafe-perm 
        - npm run build:scdn
```

## 2、流程优化

优化后的流程会变得复杂，简单的 commands 无法满足需求，因此我们编写一个 shell 脚本来处理远端构建任务。

### 2.1  node_modules 复用

实际开发过程中，依赖包的更新并不频繁，因此我们应当考虑 node_modules 的复用， 以减少其带来的消耗。

#### 2.1.1 持久化

首先，我们需要实现 node_modules 的持久化，要把它挂载到宿主机的物理磁盘中。

在 .drone.yml 中增加 volumes 相关的配置：

```yaml
steps:
    - name: build-cdn
      image: node
      pull: if-not-exists
      commands:
        - /bin/sh ./scripts/remote.build.sh # 执行自定义 shell 脚本
      volumes:	# 挂载
        - name: cache
          path: /tmp/cache

volumes:
    - name: cache # 定义宿主机数据卷
      host:
          path: /var/cache/cdnplus

```

在 remote.build.sh 中增加链接的操作：

```bash
echo "== link node_modules =="
[ -d /tmp/cache/node_modules ] || mkdir -p /tmp/cache/node_modules
ln -s /tmp/cache/node_modules ./node_modules
```

#### 2.1.2 前置条件

其次，我们需要优化 `npm i` 的执行条件，只有当真正需要安装的时候再执行。根据实际情况，我们约定2种情况需要执行安装：

- 宿主机中不存在 node_modules 目录或该目录为空
- package.json 发生了变化

```bash
[ -d /tmp/cache/node_modules ]
node_modules_existed=$?

test -f /tmp/cache/last-commit-hash && last_commit_hash=`cat /tmp/cache/last-commit-hash`
if [ -z $last_commit_hash ]; then
    #  hash 长度为 0 ，则判定为有 package.json 改变，需要执行安装操作
    echo "== /tmp/cache/last-commit-hash not existed =="
    package_json_changed=0
else
	# 查到 hash ，则和最后一次 commit 进行 diff 比较，判断是否需要执行安装操作
    echo "== last commit hash: $last_commit_hash =="
    git diff HEAD $last_commit_hash ./package.json | grep -E 'diff'
    package_json_changed=$?
fi

if [ $package_json_changed == 1 ] && [ $node_modules_existed == 0 ]; then
    echo "== package.json not changed & node_modules existed, skip 'npm i' =="
else
    echo "== package.json changed, remove node_modules/* =="
    npm i --unsafe-perm || error_exit "** npm install failed **"
fi
```

### 2.2 dist 复用

为了进一步提高效率，我们需要优化 `npm run build` 的执行条件，只有在真正需要重新构建的时候再执行。根据实际情况，我们约定2种情况需要执行构建：

- git 仓库有了更新
    - 在某些情况下，仓库内容未改变时也会执行 pipeline ，如：人为中断并重启、其他流程报错而重启
    - 处理方式为，缓存上次构建成功时的 commit hash ，用于下次开始前作对比
- 特定目录的内容有了变化
    - 仓库中除了源代码外，还会有配置文件、说明文档等内容，这些内容的更新并需要触发重新构建
    - 正常情况下，我们只监听 src 目录的变更（根据项目实际情况调整）

```bash
# 检测是否存在 last-commit-hash 文件（如果文件存在且为普通文件），如果有则读取其内容用于后续判断
test -f /tmp/cache/last-commit-hash && last_commit_hash=`cat /tmp/cache/last-commit-hash`
if [ -z $last_commit_hash ]; then
    #  hash 长度为 0 ，则判定为有文件改变，需要执行构建操作
    echo "== /tmp/cache/last-commit-hash not existed =="
    common_src_changed=0
else
    # 查到 hash ，则和最后一次 commit 进行 diff 比较，判断是否需要执行构建操作
    echo "== last commit hash: $last_commit_hash =="
    git diff HEAD $last_commit_hash ./src | grep -E 'diff'
    current_src_changed=$?
fi

# 无任何改变则跳过 build
if [ $current_src_changed == 1 ]; then
    echo "== skip build, copy last dist =="
    # 无需重新 build ，将上次保存的 dist 拷过来用于下一步的 docker 打包
    cp -rf /tmp/cache/dist/ ./dist  || error_exit "** copy last dist failed **"
else
	# 执行构建
    npm run build || error_exit "** build failed **"

    [ -d /tmp/cache/dist ] || mkdir -p /tmp/cache/dist
    cp -rf ./dist/ /tmp/cache/dist
fi
```

补充：

由于执行 `npm run build` 时，会删除 dist 目录，因此不能使用软链的方式处理，改为 cp 处理。

### 2.3 错误处理

在脚本执行异常的时候，我们需要输出特定的报错信息用于追溯，而且由于下一步对当前步强依赖，所以还要中断流程。

```bash
# 错误处理：输出指定信息到错误通道2，并退出
function error_exit {
    echo "$1" 1>&2
    exit 1
}

# 在需要的地方调用错误处理函数，例如：
npm i --unsafe-perm || error_exit "** npm install failed **"
npm run build || error_exit "** build failed **"
```

### 2.4 其他

```bash
# 设定 npm 源
echo "registry=http://192.168.90.215:4873/" >> .npmrc
```

以上优化需要根据项目实际情况进行调整。

# 四、镜像构建

## 1、Dockerfile

```dockerfile
# 使用 FROM 指定基础镜像，后面操作都是基于它进行定制
FROM nginx
# 设定环境变量
ENV NGINX_STATUS=http://localhost/status/format/json
# 创建工作目录
RUN mkdir -p /www/h5/cdn
# 指定工作目录
WORKDIR /www/h5/cdn
# 复制文件
ADD config/nginx.conf /usr/local/nginx/conf
ADD dist /www/h5/cdn
```

## 2、drone 配置

```yaml
steps:
    ...
    - name: docker-cdn
      image: registry.cn-hangzhou.aliyuncs.com/anylogic/ci-plugin-docker:18.09
      pull: if-not-exists
      settings:
          username:
              from_secret: docker_username
          password:
              from_secret: docker_password
          repo: harbor.xxx.cn/cdnplus-web # 具体项目
          registry: harbor.xxx.cn
          tags:
              - latest
              - '${DRONE_BRANCH}'
              - '${DRONE_BRANCH}-${DRONE_BUILD_NUMBER}'
          dockerfile: Dockerfile
      volumes:
          - name: hosts
            path: /etc/hosts
          - name: docker_home
            path: /var/lib/docker
            
volumes:
    - name: hosts
      host:
          path: /etc/hosts
    - name: docker_home
      host:
          path: /apps/docker
```

# 五、部署 k8s 

## 1、drone 配置

```yaml
steps:
    ...
    - name: deploy-cdn
      image: registry.cn-hangzhou.aliyuncs.com/anylogic/ci-plugin-kube:1.17.3-20200707
      commands:
          - envsubst < .drone.k8s.yaml > k8s.yaml
          - kubectl apply -f k8s.yaml
      volumes:
          - name: kube_config
            path: /apps/kube/config
volumes:
    - name: kube_config
      host:
          path: /apps/kube/config
```

## 2、k8s 配置文件

见项目根目录下 .drone.k8s.yaml

# 参考

- [YAML 入门教程](https://www.runoob.com/w3cnote/yaml-intro.html)
- [Drone 官方文档：Docker Pipelines](https://docs.drone.io/pipeline/docker/overview/)
- [drone-plugins-docker](http://plugins.drone.io/drone-plugins/drone-docker/)