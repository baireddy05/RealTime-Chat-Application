import mongoose from "mongoose";

const broadcastListSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

broadcastListSchema.index({ owner: 1, updatedAt: -1 });

const BroadcastList = mongoose.model("BroadcastList", broadcastListSchema);

export default BroadcastList;
