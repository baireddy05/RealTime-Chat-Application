import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    avatar: {
      type: String,
      default: "",
    },
    inviteCode: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true }
);

roomSchema.index({ members: 1 });
roomSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });

const Room = mongoose.model("Room", roomSchema);

export default Room;
