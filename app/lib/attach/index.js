"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const neovim_1 = require("@chemzqm/neovim");
const logger = require('../util/logger')('attach'); // tslint:disable-line
let app;
const pendingNotifications = [];
function handleNotification(nvim, method, args) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        if (!app) {
            pendingNotifications.push({ method, args });
            return;
        }
        const opts = args[0] || args;
        const bufnr = opts.bufnr;
        const buffers = yield nvim.buffers;
        const buffer = buffers.find(b => b.id === bufnr);
        if (!buffer) {
            logger.warn('buffer not found for notification: ', method, bufnr);
            return;
        }
        if (method === 'refresh_content') {
            const winline = yield nvim.call('winline');
            const currentWindow = yield nvim.window;
            const winheight = yield nvim.call('winheight', currentWindow.id);
            const cursor = yield nvim.call('getpos', '.');
            const renderOpts = yield nvim.getVar('mkdp_preview_options');
            const pageTitle = yield nvim.getVar('mkdp_page_title');
            const theme = yield nvim.getVar('mkdp_theme');
            const name = yield buffer.name;
            const content = yield buffer.getLines();
            const currentBuffer = yield nvim.buffer;
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
            });
        }
        else if (method === 'close_page') {
            app.closePage({
                bufnr
            });
        }
        else if (method === 'open_browser') {
            app.openBrowser({
                bufnr
            });
        }
    });
}
function default_1(options) {
    const nvim = (0, neovim_1.attach)(options);
    nvim.on('notification', (method, args) => tslib_1.__awaiter(this, void 0, void 0, function* () {
        yield handleNotification(nvim, method, args);
    }));
    nvim.on('request', (method, args, resp) => {
        if (method === 'close_all_pages' && app) {
            app.closeAllPages();
        }
        resp.send();
    });
    nvim.channelId
        .then((channelId) => tslib_1.__awaiter(this, void 0, void 0, function* () {
        yield nvim.setVar('mkdp_node_channel_id', channelId);
    }))
        .catch(e => {
        logger.error('channelId: ', e);
    });
    return {
        nvim,
        init: (param) => {
            app = param;
            pendingNotifications.splice(0).forEach(({ method, args }) => {
                handleNotification(nvim, method, args).catch(e => {
                    logger.error('failed to replay notification: ', method, e);
                });
            });
        }
    };
}
exports.default = default_1;
