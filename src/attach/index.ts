import { attach, Attach, NeovimClient } from '@chemzqm/neovim'

const logger = require('../util/logger')('attach') // tslint:disable-line

interface IApp {
  refreshPage: ((
    param: {
      bufnr: number | string
      data: any
    }
  ) => void)
  closePage: ((
    params: {
      bufnr: number | string
    }
  ) => void)
  closeAllPages: (() => void)
  openBrowser: ((
    params: {
      bufnr: number | string
    }
  ) => void)
}

interface IPlugin {
  init: ((app: IApp) => void)
  nvim: NeovimClient
}

let app: IApp
const pendingNotifications: Array<{ method: string; args: any[] }> = []

async function handleNotification(
  nvim: NeovimClient,
  method: string,
  args: any[]
) {
  if (!app) {
    pendingNotifications.push({ method, args })
    return
  }

  const opts = args[0] || args
  const bufnr = opts.bufnr
  const buffers = await nvim.buffers
  const buffer = buffers.find(b => b.id === bufnr)

  if (!buffer) {
    logger.warn('buffer not found for notification: ', method, bufnr)
    return
  }

  if (method === 'refresh_content') {
    const winline = await nvim.call('winline')
    const currentWindow = await nvim.window
    const winheight = await nvim.call('winheight', currentWindow.id)
    const cursor = await nvim.call('getpos', '.')
    const renderOpts = await nvim.getVar('mkdp_preview_options')
    const pageTitle = await nvim.getVar('mkdp_page_title')
    const theme = await nvim.getVar('mkdp_theme')
    const name = await buffer.name
    const content = await buffer.getLines()
    const currentBuffer = await nvim.buffer
    app.refreshPage({
      bufnr,
      data: {
        options: renderOpts,
        isActive: currentBuffer.id === buffer.id,
        winline,
        winheight,
        cursor,
        pageTitle,
        theme,
        name,
        content
      }
    })
  } else if (method === 'close_page') {
    app.closePage({
      bufnr
    })
  } else if (method === 'open_browser') {
    app.openBrowser({
      bufnr
    })
  }
}

export default function(options: Attach): IPlugin {
  const nvim: NeovimClient = attach(options)

  nvim.on('notification', async (method: string, args: any[]) => {
    await handleNotification(nvim, method, args)
  })

  nvim.on('request', (method: string, args: any, resp: any) => {
    if (method === 'close_all_pages' && app) {
      app.closeAllPages()
    }
    resp.send()
  })

  nvim.channelId
    .then(async channelId => {
      await nvim.setVar('mkdp_node_channel_id', channelId)
    })
    .catch(e => {
      logger.error('channelId: ', e)
    })

  return {
    nvim,
    init: (param: IApp) => {
      app = param
      pendingNotifications.splice(0).forEach(({ method, args }) => {
        handleNotification(nvim, method, args).catch(e => {
          logger.error('failed to replay notification: ', method, e)
        })
      })
    }
  }
}
