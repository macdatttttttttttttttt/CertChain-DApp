import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/** Mô phỏng phía Client: SHA-256 của nội dung tệp & mã băm định danh sinh viên */
const sha256 = (content: string) => ethers.sha256(ethers.toUtf8Bytes(content));
const studentHash = (id: string, dob: string) =>
  ethers.keccak256(ethers.toUtf8Bytes(`${id.toUpperCase()}|${dob}`));

const BACHELOR = 0;
const CERTIFICATE = 3;
const STATUS = { NONE: 0n, VALID: 1n, REVOKED: 2n };

describe("CertificateRegistry", function () {
  async function deployFixture() {
    const [admin, hpu, center, employer, attacker] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy();
    await registry.addIssuer(hpu.address, "Trường Đại học Hải Phòng");
    await registry.addIssuer(center.address, "Trung tâm Ngoại ngữ - Tin học HPU");

    const cert = {
      hash: sha256("PDF: Bang Ky su CNTT - Nguyen Van An - HPU-2026-000123"),
      student: studentHash("2231480001", "2004-03-15"),
      serial: "HPU-2026-000123",
      cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    };
    return { registry, admin, hpu, center, employer, attacker, cert };
  }

  async function issuedFixture() {
    const f = await deployFixture();
    await f.registry
      .connect(f.hpu)
      .issueCertificate(f.cert.hash, f.cert.student, f.cert.serial, BACHELOR, f.cert.cid);
    return f;
  }

  // ------------------------------------------------------------------
  describe("1. Triển khai & phân quyền", function () {
    it("Người triển khai giữ DEFAULT_ADMIN_ROLE", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    });

    it("Admin cấp quyền ISSUER và phát sự kiện IssuerAdded", async function () {
      const { registry, employer } = await loadFixture(deployFixture);
      await expect(registry.addIssuer(employer.address, "Trường ĐH Hàng hải"))
        .to.emit(registry, "IssuerAdded")
        .withArgs(employer.address, "Trường ĐH Hàng hải", await time.latest().then((t) => t + 1));
      expect(await registry.hasRole(await registry.ISSUER_ROLE(), employer.address)).to.equal(true);
      const info = await registry.getIssuer(employer.address);
      expect(info.name).to.equal("Trường ĐH Hàng hải");
      expect(info.active).to.equal(true);
    });

    it("Từ chối đăng ký trùng, địa chỉ rỗng hoặc tên rỗng", async function () {
      const { registry, hpu, employer } = await loadFixture(deployFixture);
      await expect(registry.addIssuer(hpu.address, "HPU"))
        .to.be.revertedWithCustomError(registry, "IssuerAlreadyRegistered")
        .withArgs(hpu.address);
      await expect(registry.addIssuer(ethers.ZeroAddress, "X")).to.be.revertedWithCustomError(registry, "InvalidInput");
      await expect(registry.addIssuer(employer.address, "")).to.be.revertedWithCustomError(registry, "InvalidInput");
    });

    it("Tài khoản không phải Admin không thể cấp quyền ISSUER", async function () {
      const { registry, attacker } = await loadFixture(deployFixture);
      await expect(registry.connect(attacker).addIssuer(attacker.address, "Trường giả mạo"))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("Admin thu hồi quyền ISSUER; đơn vị bị thu hồi không cấp bằng được nữa", async function () {
      const { registry, hpu, cert } = await loadFixture(deployFixture);
      await expect(registry.removeIssuer(hpu.address)).to.emit(registry, "IssuerRemoved");
      expect((await registry.getIssuer(hpu.address)).active).to.equal(false);
      await expect(
        registry.connect(hpu).issueCertificate(cert.hash, cert.student, cert.serial, BACHELOR, "")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.removeIssuer(hpu.address)).to.be.revertedWithCustomError(registry, "IssuerNotRegistered");
    });

    it("Kích hoạt lại đơn vị đã bị thu hồi không tạo bản ghi trùng trong danh sách", async function () {
      const { registry, hpu } = await loadFixture(deployFixture);
      await registry.removeIssuer(hpu.address);
      await registry.addIssuer(hpu.address, "Trường Đại học Hải Phòng");
      const [accounts, infos] = await registry.getIssuers();
      expect(accounts.length).to.equal(2);
      expect(infos[0].active).to.equal(true);
    });
  });

  // ------------------------------------------------------------------
  describe("2. Cấp văn bằng", function () {
    it("Đơn vị ISSUER cấp văn bằng thành công và phát sự kiện CertificateIssued", async function () {
      const { registry, hpu, cert } = await loadFixture(deployFixture);
      await expect(registry.connect(hpu).issueCertificate(cert.hash, cert.student, cert.serial, BACHELOR, cert.cid))
        .to.emit(registry, "CertificateIssued")
        .withArgs(cert.hash, cert.student, hpu.address, cert.serial, BACHELOR, await time.latest().then((t) => t + 1));
      expect(await registry.totalCertificates()).to.equal(1n);
      expect((await registry.getIssuer(hpu.address)).issuedCount).to.equal(1n);
    });

    it("Không ai ngoài ISSUER (kể cả Admin) được tự cấp văn bằng", async function () {
      const { registry, admin, attacker, cert } = await loadFixture(deployFixture);
      for (const s of [admin, attacker]) {
        await expect(
          registry.connect(s).issueCertificate(cert.hash, cert.student, cert.serial, BACHELOR, "")
        ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      }
    });

    it("Từ chối văn bằng trùng mã băm", async function () {
      const { registry, hpu, cert } = await loadFixture(issuedFixture);
      await expect(registry.connect(hpu).issueCertificate(cert.hash, cert.student, "HPU-2026-999999", BACHELOR, ""))
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyExists")
        .withArgs(cert.hash);
    });

    it("Từ chối số hiệu văn bằng đã được sử dụng", async function () {
      const { registry, center, cert } = await loadFixture(issuedFixture);
      await expect(
        registry.connect(center).issueCertificate(sha256("khac"), cert.student, cert.serial, CERTIFICATE, "")
      ).to.be.revertedWithCustomError(registry, "SerialAlreadyUsed").withArgs(cert.serial);
    });

    it("Từ chối dữ liệu đầu vào rỗng", async function () {
      const { registry, hpu, cert } = await loadFixture(deployFixture);
      const c = registry.connect(hpu);
      await expect(c.issueCertificate(ethers.ZeroHash, cert.student, cert.serial, BACHELOR, ""))
        .to.be.revertedWithCustomError(registry, "InvalidInput");
      await expect(c.issueCertificate(cert.hash, ethers.ZeroHash, cert.serial, BACHELOR, ""))
        .to.be.revertedWithCustomError(registry, "InvalidInput");
      await expect(c.issueCertificate(cert.hash, cert.student, "", BACHELOR, ""))
        .to.be.revertedWithCustomError(registry, "InvalidInput");
    });

    it("Cấp hàng loạt cho cả đợt tốt nghiệp (batch 20 văn bằng)", async function () {
      const { registry, hpu } = await loadFixture(deployFixture);
      const n = 20;
      const hashes = [...Array(n)].map((_, i) => sha256(`vb-${i}`));
      const students = [...Array(n)].map((_, i) => studentHash(`22314800${i}`, "2004-01-01"));
      const serials = [...Array(n)].map((_, i) => `HPU-2026-${String(i).padStart(6, "0")}`);
      await registry
        .connect(hpu)
        .batchIssueCertificates(hashes, students, serials, Array(n).fill(BACHELOR), Array(n).fill(""));
      expect(await registry.totalCertificates()).to.equal(BigInt(n));
      expect(await registry.isValid(hashes[n - 1])).to.equal(true);
    });

    it("Cấp hàng loạt: kiểm tra giới hạn kích thước & độ dài mảng", async function () {
      const { registry, hpu } = await loadFixture(deployFixture);
      const c = registry.connect(hpu);
      await expect(c.batchIssueCertificates([], [], [], [], [])).to.be.revertedWithCustomError(registry, "InvalidInput");
      await expect(c.batchIssueCertificates([sha256("a")], [], ["s"], [0], [""]))
        .to.be.revertedWithCustomError(registry, "ArrayLengthMismatch");
      const n = 51;
      const arr = [...Array(n)].map((_, i) => sha256(`x${i}`));
      await expect(c.batchIssueCertificates(arr, arr, arr.map(String), Array(n).fill(0), Array(n).fill("")))
        .to.be.revertedWithCustomError(registry, "BatchTooLarge")
        .withArgs(n, 50);
    });

    it("Cấp hàng loạt bị hủy toàn bộ (atomic) nếu một bản ghi lỗi", async function () {
      const { registry, hpu, cert } = await loadFixture(issuedFixture);
      await expect(
        registry.connect(hpu).batchIssueCertificates(
          [sha256("new-1"), cert.hash],
          [cert.student, cert.student],
          ["HPU-NEW-1", "HPU-NEW-2"],
          [BACHELOR, BACHELOR],
          ["", ""]
        )
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyExists");
      expect(await registry.isValid(sha256("new-1"))).to.equal(false);
      expect(await registry.totalCertificates()).to.equal(1n);
    });
  });

  // ------------------------------------------------------------------
  describe("3. Xác minh văn bằng (miễn phí Gas)", function () {
    it("Xác minh theo mã băm tệp: trả về đầy đủ thông tin và tên đơn vị cấp", async function () {
      const { registry, hpu, cert, employer } = await loadFixture(issuedFixture);
      const [c, issuerName, reason] = await registry.connect(employer).verifyCertificate(cert.hash);
      expect(c.status).to.equal(STATUS.VALID);
      expect(c.issuer).to.equal(hpu.address);
      expect(c.serialNo).to.equal(cert.serial);
      expect(c.studentHash).to.equal(cert.student);
      expect(c.ipfsCid).to.equal(cert.cid);
      expect(issuerName).to.equal("Trường Đại học Hải Phòng");
      expect(reason).to.equal("");
    });

    it("Tệp bị chỉnh sửa (dù 1 ký tự) cho mã băm khác -> không tìm thấy (status NONE)", async function () {
      const { registry, employer } = await loadFixture(issuedFixture);
      const tampered = sha256("PDF: Bang Ky su CNTT - Nguyen Van An - HPU-2026-000124");
      const [c] = await registry.connect(employer).verifyCertificate(tampered);
      expect(c.status).to.equal(STATUS.NONE);
      expect(await registry.isValid(tampered)).to.equal(false);
    });

    it("Xác minh theo số hiệu văn bằng", async function () {
      const { registry, cert } = await loadFixture(issuedFixture);
      const [c] = await registry.verifyBySerial(cert.serial);
      expect(c.certHash).to.equal(cert.hash);
      const [none] = await registry.verifyBySerial("KHONG-TON-TAI");
      expect(none.status).to.equal(STATUS.NONE);
    });

    it("Tra cứu danh sách văn bằng theo định danh sinh viên", async function () {
      const { registry, center, cert } = await loadFixture(issuedFixture);
      await registry.connect(center).issueCertificate(sha256("chung-chi"), cert.student, "TTNN-1", CERTIFICATE, "");
      const list = await registry.getStudentCertificates(cert.student);
      expect(list).to.deep.equal([cert.hash, sha256("chung-chi")]);
    });
  });

  // ------------------------------------------------------------------
  describe("4. Thu hồi văn bằng", function () {
    it("Đơn vị cấp thu hồi được văn bằng của mình, lưu lý do", async function () {
      const { registry, hpu, cert } = await loadFixture(issuedFixture);
      await expect(registry.connect(hpu).revokeCertificate(cert.hash, "Gian lận hồ sơ"))
        .to.emit(registry, "CertificateRevoked");
      const [c, , reason] = await registry.verifyCertificate(cert.hash);
      expect(c.status).to.equal(STATUS.REVOKED);
      expect(c.revokedAt).to.be.greaterThan(0n);
      expect(reason).to.equal("Gian lận hồ sơ");
      expect(await registry.isValid(cert.hash)).to.equal(false);
      expect(await registry.totalRevoked()).to.equal(1n);
    });

    it("Admin có quyền thu hồi văn bằng của bất kỳ đơn vị nào", async function () {
      const { registry, admin, cert } = await loadFixture(issuedFixture);
      await expect(registry.connect(admin).revokeCertificate(cert.hash, "Quyết định của Bộ GD&ĐT")).to.not.be.reverted;
    });

    it("Đơn vị khác / kẻ tấn công không thể thu hồi", async function () {
      const { registry, center, attacker, hpu, cert } = await loadFixture(issuedFixture);
      for (const s of [center, attacker]) {
        await expect(registry.connect(s).revokeCertificate(cert.hash, "x"))
          .to.be.revertedWithCustomError(registry, "NotCertificateIssuer")
          .withArgs(s.address, hpu.address);
      }
    });

    it("Không thu hồi văn bằng không tồn tại, đã thu hồi, hoặc thiếu lý do", async function () {
      const { registry, hpu, cert } = await loadFixture(issuedFixture);
      await expect(registry.connect(hpu).revokeCertificate(sha256("none"), "x"))
        .to.be.revertedWithCustomError(registry, "CertificateNotFound");
      await expect(registry.connect(hpu).revokeCertificate(cert.hash, ""))
        .to.be.revertedWithCustomError(registry, "InvalidInput");
      await registry.connect(hpu).revokeCertificate(cert.hash, "Sai thông tin");
      await expect(registry.connect(hpu).revokeCertificate(cert.hash, "lần 2"))
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked");
    });

    it("Văn bằng đã thu hồi không thể cấp lại với cùng mã băm", async function () {
      const { registry, hpu, cert } = await loadFixture(issuedFixture);
      await registry.connect(hpu).revokeCertificate(cert.hash, "Sai thông tin");
      await expect(registry.connect(hpu).issueCertificate(cert.hash, cert.student, "HPU-NEW", BACHELOR, ""))
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyExists");
    });
  });

  // ------------------------------------------------------------------
  describe("5. Ngắt mạch khẩn cấp (Pausable)", function () {
    it("Khi tạm dừng: chặn cấp & thu hồi nhưng vẫn cho phép xác minh", async function () {
      const { registry, hpu, cert } = await loadFixture(issuedFixture);
      await registry.pause();
      await expect(registry.connect(hpu).issueCertificate(sha256("n"), cert.student, "S-2", BACHELOR, ""))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(registry.connect(hpu).revokeCertificate(cert.hash, "x"))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      expect(await registry.isValid(cert.hash)).to.equal(true);
      await registry.unpause();
      await expect(registry.connect(hpu).issueCertificate(sha256("n"), cert.student, "S-2", BACHELOR, "")).to.not.be
        .reverted;
    });

    it("Chỉ Admin được pause / unpause", async function () {
      const { registry, attacker } = await loadFixture(deployFixture);
      await expect(registry.connect(attacker).pause()).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
      await expect(registry.connect(attacker).unpause()).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
    });
  });
});
