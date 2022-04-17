import { Controller, Get, Param, Query, UnauthorizedException } from '@nestjs/common';
import { ManagementClient } from 'authing-js-sdk';
import { AppService } from './app.service';

@Controller()
export class AppController {
  managementClient: ManagementClient;
  constructor(private readonly appService: AppService) {
    this.managementClient = new ManagementClient({
      userPoolId: 'xxxxxxxx',
      secret: 'xxxxxxxx',
    })
  }

  @Get('/applications/:appId')
  async getApplicationUsers(
    @Query('secret') secret: string,
    @Param('appId') appId: string
  ) {
    // 首先拿到 Authing 应用的 ID 和 Secret 构建一个 map
    const apps = await this.managementClient.applications.list() //注意这个地方如果应用多应该分页拿全部
    const appIdToSecret: Record<string, string> = apps.list.reduce((p, c) => {
      //@ts-ignore
      p[c.id] = c.secret
      return p
    }, {})

    // 检查用户传过来的 ID 和 Secret 是否正确
    if (!appIdToSecret[appId] || appIdToSecret[appId] !== secret) {
      throw new UnauthorizedException('访问错误，没有该应用或者应用密钥错误')
    }

    // 获取用户审计日志，拿到成功登录的用户日志，做成一个应用 ID 到用户 ids 的 map
    const userLogs = await this.managementClient.statistics.listUserActions() //注意这个地方应该分页查询所有的日志
    const successLoginLog = userLogs.list
      .filter(d => d.eventType == '登录' && d.eventResultCode == '成功')
    const applicationSuccessLoginLog = successLoginLog
      .reduce((p, c) => {
        p[c.appId] ? p[c.appId].push(c.userId) : p[c.appId] = [c.userId]
        return p
      }, {})


    // 根据传过来的应用 ID 获取该应用所有的用户
    const userIds = applicationSuccessLoginLog[appId]
    const users = await this.managementClient.users.batch(userIds, {
      queryField: 'id',
    })

    return users;
  }
}
