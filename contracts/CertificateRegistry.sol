// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  CertificateRegistry
 * @notice Sổ cái cấp phát và xác minh văn bằng / chứng chỉ đại học trên Blockchain.
 *
 *  Mô hình lưu trữ lai (Hybrid On-chain / Off-chain):
 *   - Off-chain : tệp PDF văn bằng gốc (lưu tại cơ sở đào tạo hoặc IPFS -> CID).
 *   - On-chain  : mã băm SHA-256 của tệp, mã băm định danh sinh viên, số hiệu văn bằng,
 *                 đơn vị cấp, thời điểm cấp, trạng thái (Hợp lệ / Đã thu hồi).
 *
 *  Phân quyền (Role-Based Access Control - OpenZeppelin AccessControl):
 *   - DEFAULT_ADMIN_ROLE : Cơ quan quản lý (Bộ GD&ĐT / Quản trị hệ thống) – cấp & thu hồi quyền đơn vị cấp.
 *   - ISSUER_ROLE        : Cơ sở đào tạo (trường đại học, trung tâm) – cấp và thu hồi văn bằng của chính mình.
 *   - Công chúng / Nhà tuyển dụng : chỉ gọi các hàm view để xác minh – miễn phí Gas.
 */
contract CertificateRegistry is AccessControl, Pausable {
    // =====================================================================
    // ROLES
    // =====================================================================

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // =====================================================================
    // DATA STRUCTURES
    // =====================================================================

    enum CertType {
        BACHELOR,     // 0 - Bằng Cử nhân / Kỹ sư
        MASTER,       // 1 - Bằng Thạc sĩ
        DOCTOR,       // 2 - Bằng Tiến sĩ
        CERTIFICATE   // 3 - Chứng chỉ (ngoại ngữ, tin học, khóa học ngắn hạn...)
    }

    enum Status {
        NONE,         // 0 - Không tồn tại trên sổ cái
        VALID,        // 1 - Hợp lệ
        REVOKED       // 2 - Đã bị thu hồi
    }

    /// @dev Các trường được sắp xếp để đóng gói khe nhớ (storage slot packing):
    ///      slot0: certHash | slot1: studentHash | slot2: issuer(20B) + issuedAt(8B) + certType(1B) + status(1B)
    ///      slot3: revokedAt(8B) | slot4+: serialNo | ipfsCid
    struct Certificate {
        bytes32 certHash;      // SHA-256 của tệp PDF văn bằng gốc
        bytes32 studentHash;   // keccak256(mã sinh viên + ngày sinh) – không lộ danh tính trên chuỗi
        address issuer;        // Ví của cơ sở đào tạo đã cấp
        uint64 issuedAt;       // block.timestamp lúc cấp
        CertType certType;     // Loại văn bằng
        Status status;         // Trạng thái hiện tại
        uint64 revokedAt;      // Thời điểm thu hồi (0 nếu chưa thu hồi)
        string serialNo;       // Số hiệu văn bằng in trên phôi bằng
        string ipfsCid;        // CID IPFS của bản PDF (tùy chọn, có thể rỗng)
    }

    struct Issuer {
        string name;           // Tên cơ sở đào tạo
        bool active;           // Đang được cấp quyền hay không
        uint32 issuedCount;    // Số văn bằng đã cấp
        uint64 registeredAt;   // Thời điểm được cấp quyền
    }

    // =====================================================================
    // STATE
    // =====================================================================

    mapping(bytes32 => Certificate) private _certificates;   // certHash => Certificate
    mapping(bytes32 => bytes32) private _serialToHash;       // keccak256(serialNo) => certHash
    mapping(bytes32 => bytes32[]) private _studentCerts;     // studentHash => danh sách certHash
    mapping(bytes32 => string) private _revokeReasons;       // certHash => lý do thu hồi
    mapping(address => Issuer) private _issuers;             // ví đơn vị cấp => thông tin

    address[] private _issuerList;
    uint256 public totalCertificates;
    uint256 public totalRevoked;

    uint256 public constant MAX_BATCH = 50;

    // =====================================================================
    // CUSTOM ERRORS (tiết kiệm Gas so với require + chuỗi)
    // =====================================================================

    error InvalidInput();
    error CertificateAlreadyExists(bytes32 certHash);
    error SerialAlreadyUsed(string serialNo);
    error CertificateNotFound(bytes32 certHash);
    error CertificateAlreadyRevoked(bytes32 certHash);
    error NotCertificateIssuer(address caller, address issuer);
    error IssuerAlreadyRegistered(address account);
    error IssuerNotRegistered(address account);
    error BatchTooLarge(uint256 size, uint256 max);
    error ArrayLengthMismatch();

    // =====================================================================
    // EVENTS
    // =====================================================================

    event IssuerAdded(address indexed account, string name, uint256 timestamp);
    event IssuerRemoved(address indexed account, uint256 timestamp);

    event CertificateIssued(
        bytes32 indexed certHash,
        bytes32 indexed studentHash,
        address indexed issuer,
        string serialNo,
        CertType certType,
        uint256 timestamp
    );

    event CertificateRevoked(
        bytes32 indexed certHash,
        address indexed issuer,
        string reason,
        uint256 timestamp
    );

    // =====================================================================
    // CONSTRUCTOR
    // =====================================================================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // =====================================================================
    // QUẢN LÝ ĐƠN VỊ CẤP (chỉ Admin)
    // =====================================================================

    /// @notice Cấp quyền phát hành văn bằng cho một cơ sở đào tạo.
    function addIssuer(address account, string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0) || bytes(name).length == 0) revert InvalidInput();
        if (_issuers[account].active) revert IssuerAlreadyRegistered(account);

        Issuer storage iss = _issuers[account];
        if (iss.registeredAt == 0) {
            _issuerList.push(account);
        }
        iss.name = name;
        iss.active = true;
        iss.registeredAt = uint64(block.timestamp);

        _grantRole(ISSUER_ROLE, account);
        emit IssuerAdded(account, name, block.timestamp);
    }

    /// @notice Thu hồi quyền phát hành của một cơ sở đào tạo. Văn bằng đã cấp vẫn giữ nguyên giá trị.
    function removeIssuer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_issuers[account].active) revert IssuerNotRegistered(account);
        _issuers[account].active = false;
        _revokeRole(ISSUER_ROLE, account);
        emit IssuerRemoved(account, block.timestamp);
    }

    // =====================================================================
    // CẤP VĂN BẰNG (chỉ ISSUER_ROLE)
    // =====================================================================

    /// @notice Ghi một văn bằng mới lên sổ cái.
    /// @param certHash    SHA-256 của tệp PDF văn bằng (bytes32)
    /// @param studentHash keccak256 định danh sinh viên (mã SV + ngày sinh)
    /// @param serialNo    Số hiệu văn bằng (duy nhất)
    /// @param certType    Loại văn bằng
    /// @param ipfsCid     CID IPFS của tệp (có thể để trống)
    function issueCertificate(
        bytes32 certHash,
        bytes32 studentHash,
        string calldata serialNo,
        CertType certType,
        string calldata ipfsCid
    ) external whenNotPaused onlyRole(ISSUER_ROLE) {
        _issue(certHash, studentHash, serialNo, certType, ipfsCid);
        unchecked {
            totalCertificates += 1;
            _issuers[msg.sender].issuedCount += 1;
        }
    }

    /// @notice Cấp văn bằng hàng loạt cho cả một đợt tốt nghiệp (tối đa MAX_BATCH bản ghi / giao dịch).
    function batchIssueCertificates(
        bytes32[] calldata certHashes,
        bytes32[] calldata studentHashes,
        string[] calldata serialNos,
        CertType[] calldata certTypes,
        string[] calldata ipfsCids
    ) external whenNotPaused onlyRole(ISSUER_ROLE) {
        uint256 n = certHashes.length;
        if (n == 0) revert InvalidInput();
        if (n > MAX_BATCH) revert BatchTooLarge(n, MAX_BATCH);
        if (
            studentHashes.length != n || serialNos.length != n ||
            certTypes.length != n || ipfsCids.length != n
        ) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < n; ) {
            _issue(certHashes[i], studentHashes[i], serialNos[i], certTypes[i], ipfsCids[i]);
            unchecked { ++i; }
        }
        unchecked {
            totalCertificates += n;
            _issuers[msg.sender].issuedCount += uint32(n);
        }
    }

    function _issue(
        bytes32 certHash,
        bytes32 studentHash,
        string calldata serialNo,
        CertType certType,
        string calldata ipfsCid
    ) private {
        if (certHash == bytes32(0) || studentHash == bytes32(0) || bytes(serialNo).length == 0) {
            revert InvalidInput();
        }
        if (_certificates[certHash].status != Status.NONE) revert CertificateAlreadyExists(certHash);

        bytes32 serialKey = keccak256(bytes(serialNo));
        if (_serialToHash[serialKey] != bytes32(0)) revert SerialAlreadyUsed(serialNo);

        _certificates[certHash] = Certificate({
            certHash: certHash,
            studentHash: studentHash,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            certType: certType,
            status: Status.VALID,
            revokedAt: 0,
            serialNo: serialNo,
            ipfsCid: ipfsCid
        });
        _serialToHash[serialKey] = certHash;
        _studentCerts[studentHash].push(certHash);

        emit CertificateIssued(certHash, studentHash, msg.sender, serialNo, certType, block.timestamp);
    }

    // =====================================================================
    // THU HỒI VĂN BẰNG
    // =====================================================================

    /// @notice Thu hồi văn bằng (cấp sai, gian lận học thuật...). Chỉ đơn vị đã cấp hoặc Admin được thực hiện.
    ///         Bản ghi KHÔNG bị xóa – lịch sử thu hồi luôn có thể kiểm chứng.
    function revokeCertificate(bytes32 certHash, string calldata reason) external whenNotPaused {
        Certificate storage c = _certificates[certHash];
        if (c.status == Status.NONE) revert CertificateNotFound(certHash);
        if (c.status == Status.REVOKED) revert CertificateAlreadyRevoked(certHash);
        if (c.issuer != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotCertificateIssuer(msg.sender, c.issuer);
        }
        if (bytes(reason).length == 0) revert InvalidInput();

        c.status = Status.REVOKED;
        c.revokedAt = uint64(block.timestamp);
        _revokeReasons[certHash] = reason;
        unchecked { totalRevoked += 1; }

        emit CertificateRevoked(certHash, msg.sender, reason, block.timestamp);
    }

    // =====================================================================
    // XÁC MINH (view – miễn phí Gas cho nhà tuyển dụng)
    // =====================================================================

    /// @notice Xác minh văn bằng theo mã băm SHA-256 của tệp PDF.
    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (Certificate memory cert, string memory issuerName, string memory revokeReason)
    {
        cert = _certificates[certHash];
        issuerName = _issuers[cert.issuer].name;
        revokeReason = _revokeReasons[certHash];
    }

    /// @notice Xác minh văn bằng theo số hiệu in trên phôi bằng.
    function verifyBySerial(string calldata serialNo)
        external
        view
        returns (Certificate memory cert, string memory issuerName, string memory revokeReason)
    {
        bytes32 h = _serialToHash[keccak256(bytes(serialNo))];
        cert = _certificates[h];
        issuerName = _issuers[cert.issuer].name;
        revokeReason = _revokeReasons[h];
    }

    /// @notice Kiểm tra nhanh: văn bằng có tồn tại và còn hiệu lực hay không.
    function isValid(bytes32 certHash) external view returns (bool) {
        return _certificates[certHash].status == Status.VALID;
    }

    /// @notice Danh sách mã băm văn bằng của một sinh viên.
    function getStudentCertificates(bytes32 studentHash) external view returns (bytes32[] memory) {
        return _studentCerts[studentHash];
    }

    function getIssuer(address account) external view returns (Issuer memory) {
        return _issuers[account];
    }

    function getIssuers() external view returns (address[] memory accounts, Issuer[] memory infos) {
        uint256 n = _issuerList.length;
        accounts = _issuerList;
        infos = new Issuer[](n);
        for (uint256 i = 0; i < n; ) {
            infos[i] = _issuers[_issuerList[i]];
            unchecked { ++i; }
        }
    }

    // =====================================================================
    // NGẮT MẠCH KHẨN CẤP (Circuit Breaker)
    // =====================================================================

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
