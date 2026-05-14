const { asyncHandler } = require("../../shared/asyncHandler");
const {
  getMe,
  getEmployeeOwnAccount,
  login,
  register,
  createEmployeeByAdmin,
  getEmployeesByAdmin,
  deleteEmployeeByAdmin,
  updateRegisteredUserByAdmin,
  updateEmployeeOwnAccount,
  getStylistsForCalendar,
  updateEmployeeLocation
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

const employeeOwnAccountController = asyncHandler(async (req, res) => {
  const data = await getEmployeeOwnAccount(req.auth.sub);
  res.json({ ok: true, data });
});

const updateEmployeeOwnAccountController = asyncHandler(async (req, res) => {
  const data = await updateEmployeeOwnAccount(req.auth.sub, req.body);
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
  const data = await deleteEmployeeByAdmin(req.params.employeeId, req.auth.sub);
  res.json({ ok: true, data });
});

const updateRegisteredUserByAdminController = asyncHandler(async (req, res) => {
  const data = await updateRegisteredUserByAdmin(req.params.employeeId, req.body, req.auth.sub);
  res.json({ ok: true, data });
});

const stylistsController = asyncHandler(async (req, res) => {
  const data = await getStylistsForCalendar(req.query.locationId);
  res.json({ ok: true, data });
});

const updateEmployeeLocationController = asyncHandler(async (req, res) => {
  const data = await updateEmployeeLocation(req.params.employeeId, req.body);
  res.json({ ok: true, data });
});

module.exports = {
  registerController,
  loginController,
  meController,
  employeeOwnAccountController,
  updateEmployeeOwnAccountController,
  createEmployeeByAdminController,
  listEmployeesByAdminController,
  deleteEmployeeByAdminController,
  updateRegisteredUserByAdminController,
  stylistsController,
  updateEmployeeLocationController
};
