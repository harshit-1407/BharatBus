import { Schema, model } from 'mongoose';

const point = { type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } }; // [lng, lat]

const stopSchema = new Schema({ operatorId: String, name: String, location: point, source: String });
stopSchema.index({ location: '2dsphere' });

const routeSchema = new Schema({
  operatorId: String, code: String, direction: String,
  stops: [{ stopId: Schema.Types.ObjectId, seq: Number }],
  geometry: { type: { type: String, enum: ['LineString'] }, coordinates: [[Number]] },
});
routeSchema.index({ operatorId: 1, code: 1, direction: 1 });

const busPositionSchema = new Schema({
  operatorId: String, busId: String, tripId: String, routeId: String,
  location: point, gpsTimestamp: Date, receivedAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['LIVE', 'SIMULATED'] },
});
busPositionSchema.index({ location: '2dsphere' });
busPositionSchema.index({ busId: 1, gpsTimestamp: -1 });
busPositionSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 }); // TTL: 24h

export const Stop = model('Stop', stopSchema);
export const Route = model('Route', routeSchema);
export const BusPosition = model('BusPosition', busPositionSchema);
