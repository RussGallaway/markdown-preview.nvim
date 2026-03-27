local M = {}

function M.setup(opts)
  for key, value in pairs(opts or {}) do
    vim.g[key] = value
  end
end

return M
