为了更好的学习整个 CI/CD 流程，在本地部署一套 Gogs+Drone 用于练习测试。

# 一、Win10 安装 linux 子系统

WSL2 重新设计了架构，使用真正的 Linux 内核，几乎具有 Linux 的所有完整功能。启用 WSL2 的 Linux 系统启动时间非常快，内存占用很少，并且 WSL2 还可以直接原生运行 Docker 。

## 1、启用 Windows 功能

### 1.1 适用于 Linux 的 Windows 子系统

- 方法一：控制面板 -> 程序和功能 -> 启用或关闭window功能 -> 勾选“适用于Linux的Windows子系统”
- 方法二：以管理员身份打开 PowerShell 并运行

```bash
$ dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

### 1.2 虚拟机平台

- 方法一：控制面板 -> 程序和功能 -> 启用或关闭window功能 -> 勾选“虚拟机平台”
- 方法二：以管理员身份打开 PowerShell 并运行

```bash
$ dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

## 2、升级 Win10 到指定版本

对于 x64 系统，需要版本 1903 以上的版本（内部版本 18362 以上）才支持 WSL2。可以通过 `winver` 命令查看本机当前版本。可使用 [Windows Update 助手](https://www.microsoft.com/software-download/windows10) 更新系统版本。

## 3、设置 WSL2 为默认版本

```bash
$ wsl --set-default-version 2
```

## 4、安装  Ubuntu

进入 Window 自带的 Microsoft store，搜索ubuntu，选择18.04LTS 进行安装。

## 5、启用 SSH 并配置模拟终端器

### 5.1 启用 ssh

```bash
# 1、设置root的口令（密码），用作后续登陆使用
sudo passwd root

# 备份
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# 2、编辑配置
sudo vim /etc/ssh/sshd_config
```

在 sshd_config 中找到下面四处并修改：

```bash
Port = 8022
ListenAddress 0.0.0.0		# 如果需要指定监听的 IP 则去除最左侧的井号，并配置对应 IP ，默认即监听 PC 所有 IP
PermitRootLogin yes			# 如果你需要用 root 直接登录系统则此处改为 yes
PasswordAuthentication yes	 # 将 no 改为 yes 表示使用帐号密码方式登录
```

启动SSH并检查状态：

```bash
sudo service ssh start		# 启动SSH服务
sudo service ssh status		# 检查状态
sudo systemctl enable ssh	# 开机自动启动ssh命令
```

### 5.2 使用 MobaXterm 客户端登录

1. 点击创建 Session
2. 选择 WSL
3. Linux 发行版选择 Ubentu 
4. 其他配置默认，创建即可

# 二、Docker 安装与配置

Docker 是一种应用容器引擎，容器是完全使用沙箱机制，且性能开销极低。使用 Docker，可以让应用的部署、测试和分发都变得前所未有的高效和轻松，我们后面的工作都将依赖它。

## 1、安装 Docker Desktop for Windows

[下载地址](https://docs.docker.com/docker-for-windows/install/)

对 win 10 系统有要求，具体的可以官方文档。此外，需要开启 Hyper-V ，同样有两种方法：

- 方法一：控制面板 -> 程序和功能 -> 启用或关闭window功能 -> 勾选“Hyper-V”
- 方法二：以管理员身份打开 PowerShell 并运行

```bash
$ Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

## 2、配置

### 21 General

- 勾选 Use the WSL 2 based engine
- 勾选 Expose daemon on tcp://localhost:2375 without TLS
    - 如果后面发现 wsl 连不上 docker ，可以尝试添加 C:\ProgramData\Docker\config\daemon.json 并配置 `{ "hosts": ["tcp://127.0.0.1:2375"] }`

### 2.2 Resources

- WSL Integration 子菜单中
    - 勾选 Enable integration with my default WSL distro
    - 启用所需的 Linux 分发版，此处我们选择 Ubuntu-18.04

### 2.3 Docker Engine

- 可以根据需要设定 `registry-mirrors`，提高镜像下载速度

## 3、测试

```bash
$ docker run hello-world
$ docker images
$ docker ps
```

# 三、部署 Gogs

Gogs 是一款极易搭建的自助 Git 服务。

## 1、使用 Docker 启动 Gogs

```bash
$ docker run \
  --volume=/var/lib/gogs:/data \
  --publish=6022:22 \
  --publish=6023:3000 \
  --restart=always \
  --name=gogs \
  gogs/gogs
```

字段说明：

- volume ：用于绑定数据存储的实际地址 `/var/lib/gogs`
- publish ：指定端口映射，`主机(宿主)端口:容器端口`，其中 6022 是 ssh 端口，6023 是 web 访问端口

## 2、配置 Gogs

根据上面的配置，在容器成功启动后，用浏览器访问：`http://ip:6023` 来完成后续的安装。

注：ip 是本机的 ipv4 地址，通过 `ipconfig` 查看。

### 2.1 数据库设置

为了简便，我们就不选择 mysql 了，配置过于繁琐。这里我们选择使用 **SQLite3** 类型的数据，无须额外的配置即可使用。

### 2.2 应用设置

- SSH 端口：22（默认即可）
- HTTP 端口：3000（默认即可）
- 应用 URL ：http://192.168.0.105:6023/ （根据本机 ip 设置，在和其他应用关联时使用）

## 3、测试

自行注册账号登录即可。尝试创建仓库，并关联本地 git 仓库，执行推送进行测试。（注意实际使用的 web 端口是 6023）

## 4、管理 Web 钩子

注：本步在部署完 Drone 后在进行。

点击页面右上角的`仓库设置`进入管理界面，切换到`管理 Web 钩子`菜单，如果正确配置了 Drone ，此时应该在该页面看到一个 灰色的 Web 钩子配置。

该钩子不需要做任何修改，点击页面底部的`测试推送`验证钩子是否正常即可。

# 四、部署 Drone

基于 `Docker` 的 `CI/CD` 工具 `Drone` 所有编译、测试的流程都在 `Docker` 容器中进行。相对于`Jenkins`来说更加轻量，可以配合轻量的`Gogs`来实现持续集成。开发者只需在项目中包含 `.drone.yml` 文件，将代码推送到 git 仓库，`Drone` 就能够自动化的进行编译、测试、发布。

## 1、使用 Docker 启动 Drone

### 1.1 drone

```bash
$ docker pull drone/drone:1

$ docker run \
  --volume=/var/lib/drone:/data \
  --env=DRONE_AGENTS_ENABLED=true \
  --env=DRONE_GOGS_SERVER=http://192.168.0.105:6023 \
  --env=DRONE_RPC_SECRET=secret \
  --env=DRONE_SERVER_HOST=10.190.180.53:80 \
  --env=DRONE_SERVER_PROTO=http \
  --env=DRONE_USER_CREATE=username:wangyuegong,admin:true \
  --publish=80:80 \
  --publish=443:443 \
  --restart=always \
  --detach=true \
  --name=drone \
  drone/drone:1
```

字段说明：

- env ：设置环境变量
    - DRONE_GOGS_SERVER ：配置为 Gogs 的访问地址，不能使用 localhost 或 127.0.0.1 
    - DRONE_RPC_SECRET ：RPC Secret ，用来和下面 runner 通信
    - DRONE_SERVER_HOST ：Drone 的访问地址，ip 或域名
    - DRONE_SERVER_PROTO ：访问协议
    - DRONE_USER_CREATE ：指定 Drone 启动时创建的用户
- volume 、publish 不再赘述

特别说明：

`DRONE_USER_CREATE=username:wangyuegong,admin:true ` 该环境变量的设定，是为了指定该用户为管理员。目的是为了能开启 Drone 的特殊配置，主要用到的是在 SETTINGS 界面中，Project settings 一栏增加 `Trusted` 选项（用于解决 untrusted repositories cannot mount host volumes 报错）。其中用户名是 Gogs 中的账户名（Drone 直接使用的 Ggos 的账户）。

### 1.2 drone-runner

drone runner 的作用是：询问 drone server ，然后执行 build pipelines 。drone runner 依赖于 drone server 的运行。

```bash
$ docker pull drone/drone-runner-docker:1

$ docker run -d \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DRONE_RPC_PROTO=http \
  -e DRONE_RPC_HOST=10.190.180.53:80 \
  -e DRONE_RPC_SECRET=secret \
  -e DRONE_RUNNER_CAPACITY=2 \
  -e DRONE_RUNNER_NAME=demo \
  -p 3000:3000 \
  --restart always \
  --name runner \
  drone/drone-runner-docker:1
```

字段说明：

- env(e) ：设置环境变量
    - DRONE_RPC_PROTO：同第一步的 DRONE_SERVER_PROTO
    - DRONE_RPC_HOST：同第一步的 DRONE_SERVER_HOST
    - DRONE_RPC_SECRET：同第一步的 DRONE_RPC_SECRET
- volume(v) 、publish(p) 不再赘述

## 2、测试

使用 Gogs 账户名登录 Drone ，激活列表中指定的仓库（如果未找到手动 SYNC），修改配置（SETTINGS -> Project settings -> 勾选"Trusted"）。

推送测试代码 Gogs ，查看 Drone 是否正常执行预定流程。



```yaml
version: "3"
services:
  gogs:
    restart: always    # 自动重启
    image: gogs/gogs
    container_name: gogs
    ports:
      - '6022:22'      # ssh 端口
      - '6023:3000'    # Web 访问端口
    volumes:
      - /var/lib/gogs:/data   # 数据存储
  drone-server:
    restart: always     # 自动重启
    image: drone/drone:1
    ports:
      - 443:443
      - 80:80
    depends_on:
      - gogs    # 依赖
    volumes:
      - /var/lib/drone:/data # 数据存储
    environment:
      - DRONE_AGENTS_ENABLED=true
      - DRONE_GOGS_SERVER=http://192.168.0.105:6023 # gogs 访问地址，不能用 localhost 或 127.0.0.1 访问
      - DRONE_RPC_SECRET=secret # RPC Secret，用来和下面runner通信的
      - DRONE_SERVER_HOST=192.168.0.105:80 # Drone自己的地址，可以是内网地址，也可以是域名
      - DRONE_SERVER_PROTO=http
  drone-runner:
    restart: always
    image: drone/drone-runner-docker:1
    depends_on:
      - drone-server    # 依赖
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DRONE_RPC_PROTO=http  # 上面填的 DRONE_SERVER_PROTO
      - DRONE_RPC_HOST=192.168.0.105:80  # 上面填的 DRONE_SERVER_HOST
      - DRONE_RPC_SECRET=secret # 上面填的 DRONE_RPC_SECRET
      - DRONE_RUNNER_CAPACITY=2
      - DRONE_RUNNER_NAME=demo
```



# 参考

- [适用于 Linux 的 Windows 子系统安装指南 (Windows 10)](https://docs.microsoft.com/zh-cn/windows/wsl/install-win10)
- [Win10下的 WSL+Docker](https://zhuanlan.zhihu.com/p/61542198)
- [Docker — 从入门到实践](https://docker_practice.gitee.io/zh-cn/)
- [官方文档：如何为 Gogs 安装 Drone 服务器](https://docs.drone.io/server/provider/gogs/)
- [官方文档： Install the Docker runner on Linux](https://docs.drone.io/runner/docker/installation/linux/)