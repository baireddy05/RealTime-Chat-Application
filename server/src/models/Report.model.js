import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reported: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, reported: 1 });
reportSchema.index({ reported: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
