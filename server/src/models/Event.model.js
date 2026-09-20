import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      default: "",
      maxlength: 200,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rsvps: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["going", "maybe", "declined"], default: "going" },
        at: { type: Date, default: Date.now },
      },
    ],
    isCancelled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

eventSchema.index({ roomId: 1, startsAt: 1 });
eventSchema.index({ roomId: 1, isCancelled: 1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
