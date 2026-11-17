import { BaseError, ContractFunctionRevertedError } from "viem";

const MESSAGES: Record<string, string> = {
  InvalidInput: "Dữ liệu đầu vào không hợp lệ (thiếu mã băm, định danh sinh viên, số hiệu hoặc lý do).",
  CertificateAlreadyExists: "Văn bằng có mã băm này đã tồn tại trên sổ cái.",
  SerialAlreadyUsed: "Số hiệu văn bằng đã được sử dụng.",
  CertificateNotFound: "Không tìm thấy văn bằng trên sổ cái.",
  CertificateAlreadyRevoked: "Văn bằng đã bị thu hồi trước đó.",
  NotCertificateIssuer: "Chỉ đơn vị đã cấp (hoặc Quản trị viên) mới được thu hồi văn bằng này.",
  IssuerAlreadyRegistered: "Ví này đã là đơn vị cấp văn bằng.",
  IssuerNotRegistered: "Ví này chưa được cấp quyền đơn vị cấp văn bằng.",
  BatchTooLarge: "Số lượng văn bằng trong một lô vượt quá giới hạn.",
  ArrayLengthMismatch: "Độ dài các mảng dữ liệu không khớp nhau.",
  AccessControlUnauthorizedAccount: "Tài khoản hiện tại không có quyền thực hiện thao tác này.",
  EnforcedPause: "Hệ thống đang tạm dừng (Pause) – không thể ghi dữ liệu.",
};

export function toVietnameseError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "";
      if (MESSAGES[name]) return `${MESSAGES[name]} (${name})`;
    }
    if (err.shortMessage?.includes("User rejected")) return "Người dùng đã từ chối ký giao dịch.";
    return err.shortMessage || err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
