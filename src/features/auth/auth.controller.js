const { asyncHandler } = require("../../shared/asyncHandler");
const {
  getMe,
  login,
  register,
  createEmployeeByAdmin,
  getEmployeesByAdmin,
  deleteEmployeeByAdmin
} = require("./auth.service");

const registerController = asyncHandler(async (req, res) => {
  const data = await register(req.body);
  res.status(201).json({ ok: true, data });
});

const loginController = asyncHandler(async (req, res) => {
  const data = await login(req.body);
  res.json({ ok: true, data });
});

const meController = asyncHandler(async (req, res) => {
  const data = await getMe(req.auth.sub);
  res.json({ ok: true, data });
});

const createEmployeeByAdminController = asyncHandler(async (req, res) => {
  const data = await createEmployeeByAdmin(req.body);
  res.status(201).json({ ok: true, data });
});

const listEmployeesByAdminController = asyncHandler(async (_req, res) => {
  const data = await getEmployeesByAdmin();
  res.json({ ok: true, data });
});

const deleteEmployeeByAdminController = asyncHandler(async (req, res) => {
  const data = await deleteEmployeeByAdmin(req.params.employeeId);
  res.json({ ok: true, data });
});

module.exports = {
  registerController,
  loginController,
  meController,
  createEmployeeByAdminController,
  listEmployeesByAdminController,
  deleteEmployeeByAdminController
};
