const locationModel = require("./location.model");

async function listAll() {
  return locationModel.listLocations();
}

async function createOne({ name, address, region }) {
  if (!name || !name.trim()) {
    throw new Error("El nombre del local es obligatorio.");
  }
  if (!address || !address.trim()) {
    throw new Error("La direccion del local es obligatoria.");
  }
  if (!region || !region.trim()) {
    throw new Error("La region del local es obligatoria.");
  }

  return locationModel.createLocation({
    name: name.trim(),
    address: address.trim(),
    region: region.trim()
  });
}

async function updateOne(id, { name, address, region }) {
  const existing = await locationModel.findLocationById(id);
  if (!existing) {
    throw new Error("Local no encontrado.");
  }

  return locationModel.updateLocation(id, {
    name: name ? name.trim() : undefined,
    address: address ? address.trim() : undefined,
    region: region ? region.trim() : undefined
  });
}

async function deleteOne(id) {
  const existing = await locationModel.findLocationById(id);
  if (!existing) {
    throw new Error("Local no encontrado.");
  }

  return locationModel.deleteLocation(id);
}

module.exports = {
  listAll,
  createOne,
  updateOne,
  deleteOne
};
