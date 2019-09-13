pragma solidity ^0.5.2;
// ZoKrates version of the verifier
/**
 *  Downloaded from https://raw.githubusercontent.com/Zokrates/ZoKrates/develop/zokrates_core/src/proof_system/bn128/utils/solidity.rs
 *  after commit https://github.com/Zokrates/ZoKrates/commit/799f528481dbb96d0e8d9c72f3fbbffb775154de (Feb 28 2019)
 *
 */

// This file is LGPL3 Licensed

/**
 * @title Elliptic curve operations on twist points for alt_bn128
 * @author Mustafa Al-Bassam (mus@musalbas.com)
 */
library BN256G2 {
    uint256 internal constant FIELD_MODULUS = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47;
    uint256 internal constant TWISTBX = 0x2b149d40ceb8aaae81be18991be06ac3b5b4c5e559dbefa33267e6dc24a138e5;
    uint256 internal constant TWISTBY = 0x9713b03af0fed4cd2cafadeed8fdf4a74fa084e52d1852e4a2bd0685c315d2;
    uint internal constant PTXX = 0;
    uint internal constant PTXY = 1;
    uint internal constant PTYX = 2;
    uint internal constant PTYY = 3;
    uint internal constant PTZX = 4;
    uint internal constant PTZY = 5;

    /**
     * @notice Add two twist points
     * @param pt1xx Coefficient 1 of x on point 1
     * @param pt1xy Coefficient 2 of x on point 1
     * @param pt1yx Coefficient 1 of y on point 1
     * @param pt1yy Coefficient 2 of y on point 1
     * @param pt2xx Coefficient 1 of x on point 2
     * @param pt2xy Coefficient 2 of x on point 2
     * @param pt2yx Coefficient 1 of y on point 2
     * @param pt2yy Coefficient 2 of y on point 2
     * @return (pt3xx, pt3xy, pt3yx, pt3yy)
     */
    function ECTwistAdd(
        uint256 pt1xx, uint256 pt1xy,
        uint256 pt1yx, uint256 pt1yy,
        uint256 pt2xx, uint256 pt2xy,
        uint256 pt2yx, uint256 pt2yy
    ) public pure returns (
        uint256, uint256,
        uint256, uint256
    ) {
        if (
            pt1xx == 0 && pt1xy == 0 &&
            pt1yx == 0 && pt1yy == 0
        ) {
            if (!(
                pt2xx == 0 && pt2xy == 0 &&
                pt2yx == 0 && pt2yy == 0
            )) {
                assert(_isOnCurve(
                    pt2xx, pt2xy,
                    pt2yx, pt2yy
                ));
            }
            return (
                pt2xx, pt2xy,
                pt2yx, pt2yy
            );
        } else if (
            pt2xx == 0 && pt2xy == 0 &&
            pt2yx == 0 && pt2yy == 0
        ) {
            assert(_isOnCurve(
                pt1xx, pt1xy,
                pt1yx, pt1yy
            ));
            return (
                pt1xx, pt1xy,
                pt1yx, pt1yy
            );
        }

        assert(_isOnCurve(
            pt1xx, pt1xy,
            pt1yx, pt1yy
        ));
        assert(_isOnCurve(
            pt2xx, pt2xy,
            pt2yx, pt2yy
        ));

        uint256[6] memory pt3 = _ECTwistAddJacobian(
            pt1xx, pt1xy,
            pt1yx, pt1yy,
            1,     0,
            pt2xx, pt2xy,
            pt2yx, pt2yy,
            1,     0
        );

        return _fromJacobian(
            pt3[PTXX], pt3[PTXY],
            pt3[PTYX], pt3[PTYY],
            pt3[PTZX], pt3[PTZY]
        );
    }

    /**
     * @notice Multiply a twist point by a scalar
     * @param s     Scalar to multiply by
     * @param pt1xx Coefficient 1 of x
     * @param pt1xy Coefficient 2 of x
     * @param pt1yx Coefficient 1 of y
     * @param pt1yy Coefficient 2 of y
     * @return (pt2xx, pt2xy, pt2yx, pt2yy)
     */
    function ECTwistMul(
        uint256 s,
        uint256 pt1xx, uint256 pt1xy,
        uint256 pt1yx, uint256 pt1yy
    ) public pure returns (
        uint256, uint256,
        uint256, uint256
    ) {
        uint256 pt1zx = 1;
        if (
            pt1xx == 0 && pt1xy == 0 &&
            pt1yx == 0 && pt1yy == 0
        ) {
            pt1xx = 1;
            pt1yx = 1;
            pt1zx = 0;
        } else {
            assert(_isOnCurve(
                pt1xx, pt1xy,
                pt1yx, pt1yy
            ));
        }

        uint256[6] memory pt2 = _ECTwistMulJacobian(
            s,
            pt1xx, pt1xy,
            pt1yx, pt1yy,
            pt1zx, 0
        );

        return _fromJacobian(
            pt2[PTXX], pt2[PTXY],
            pt2[PTYX], pt2[PTYY],
            pt2[PTZX], pt2[PTZY]
        );
    }

    /**
     * @notice Get the field modulus
     * @return The field modulus
     */
    function GetFieldModulus() public pure returns (uint256) {
        return FIELD_MODULUS;
    }

    function submod(uint256 a, uint256 b, uint256 n) internal pure returns (uint256) {
        return addmod(a, n - b, n);
    }

    function _FQ2Mul(
        uint256 xx, uint256 xy,
        uint256 yx, uint256 yy
    ) internal pure returns(uint256, uint256) {
        return (
            submod(mulmod(xx, yx, FIELD_MODULUS), mulmod(xy, yy, FIELD_MODULUS), FIELD_MODULUS),
            addmod(mulmod(xx, yy, FIELD_MODULUS), mulmod(xy, yx, FIELD_MODULUS), FIELD_MODULUS)
        );
    }

    function _FQ2Muc(
        uint256 xx, uint256 xy,
        uint256 c
    ) internal pure returns(uint256, uint256) {
        return (
            mulmod(xx, c, FIELD_MODULUS),
            mulmod(xy, c, FIELD_MODULUS)
        );
    }

    function _FQ2Add(
        uint256 xx, uint256 xy,
        uint256 yx, uint256 yy
    ) internal pure returns(uint256, uint256) {
        return (
            addmod(xx, yx, FIELD_MODULUS),
            addmod(xy, yy, FIELD_MODULUS)
        );
    }

    function _FQ2Sub(
        uint256 xx, uint256 xy,
        uint256 yx, uint256 yy
    ) internal pure returns(uint256 rx, uint256 ry) {
        return (
            submod(xx, yx, FIELD_MODULUS),
            submod(xy, yy, FIELD_MODULUS)
        );
    }

    function _FQ2Div(
        uint256 xx, uint256 xy,
        uint256 yx, uint256 yy
    ) internal pure returns(uint256, uint256) {
        (yx, yy) = _FQ2Inv(yx, yy);
        return _FQ2Mul(xx, xy, yx, yy);
    }

    function _FQ2Inv(uint256 x, uint256 y) internal pure returns(uint256, uint256) {
        uint256 inv = _modInv(addmod(mulmod(y, y, FIELD_MODULUS), mulmod(x, x, FIELD_MODULUS), FIELD_MODULUS), FIELD_MODULUS);
        return (
            mulmod(x, inv, FIELD_MODULUS),
            FIELD_MODULUS - mulmod(y, inv, FIELD_MODULUS)
        );
    }

    function _isOnCurve(
        uint256 xx, uint256 xy,
        uint256 yx, uint256 yy
    ) internal pure returns (bool) {
        uint256 yyx;
        uint256 yyy;
        uint256 xxxx;
        uint256 xxxy;
        (yyx, yyy) = _FQ2Mul(yx, yy, yx, yy);
        (xxxx, xxxy) = _FQ2Mul(xx, xy, xx, xy);
        (xxxx, xxxy) = _FQ2Mul(xxxx, xxxy, xx, xy);
        (yyx, yyy) = _FQ2Sub(yyx, yyy, xxxx, xxxy);
        (yyx, yyy) = _FQ2Sub(yyx, yyy, TWISTBX, TWISTBY);
        return yyx == 0 && yyy == 0;
    }

    function _modInv(uint256 a, uint256 n) internal pure returns(uint256 t) {
        t = 0;
        uint256 newT = 1;
        uint256 r = n;
        uint256 newR = a;
        uint256 q;
        while (newR != 0) {
            q = r / newR;
            (t, newT) = (newT, submod(t, mulmod(q, newT, n), n));
            (r, newR) = (newR, r - q * newR);
        }
    }

    function _fromJacobian(
        uint256 pt1xx, uint256 pt1xy,
        uint256 pt1yx, uint256 pt1yy,
        uint256 pt1zx, uint256 pt1zy
    ) internal pure returns (
        uint256 pt2xx, uint256 pt2xy,
        uint256 pt2yx, uint256 pt2yy
    ) {
        uint256 invzx;
        uint256 invzy;
        (invzx, invzy) = _FQ2Inv(pt1zx, pt1zy);
        (pt2xx, pt2xy) = _FQ2Mul(pt1xx, pt1xy, invzx, invzy);
        (pt2yx, pt2yy) = _FQ2Mul(pt1yx, pt1yy, invzx, invzy);
    }

    function _ECTwistAddJacobian(
        uint256 pt1xx, uint256 pt1xy,
        uint256 pt1yx, uint256 pt1yy,
        uint256 pt1zx, uint256 pt1zy,
        uint256 pt2xx, uint256 pt2xy,
        uint256 pt2yx, uint256 pt2yy,
        uint256 pt2zx, uint256 pt2zy) internal pure returns (uint256[6] memory pt3) {
            if (pt1zx == 0 && pt1zy == 0) {
                (
                    pt3[PTXX], pt3[PTXY],
                    pt3[PTYX], pt3[PTYY],
                    pt3[PTZX], pt3[PTZY]
                ) = (
                    pt2xx, pt2xy,
                    pt2yx, pt2yy,
                    pt2zx, pt2zy
                );
                return pt3;
            } else if (pt2zx == 0 && pt2zy == 0) {
                (
                    pt3[PTXX], pt3[PTXY],
                    pt3[PTYX], pt3[PTYY],
                    pt3[PTZX], pt3[PTZY]
                ) = (
                    pt1xx, pt1xy,
                    pt1yx, pt1yy,
                    pt1zx, pt1zy
                );
                return pt3;
            }

            (pt2yx,     pt2yy)     = _FQ2Mul(pt2yx, pt2yy, pt1zx, pt1zy); // U1 = y2 * z1
            (pt3[PTYX], pt3[PTYY]) = _FQ2Mul(pt1yx, pt1yy, pt2zx, pt2zy); // U2 = y1 * z2
            (pt2xx,     pt2xy)     = _FQ2Mul(pt2xx, pt2xy, pt1zx, pt1zy); // V1 = x2 * z1
            (pt3[PTZX], pt3[PTZY]) = _FQ2Mul(pt1xx, pt1xy, pt2zx, pt2zy); // V2 = x1 * z2

            if (pt2xx == pt3[PTZX] && pt2xy == pt3[PTZY]) {
                if (pt2yx == pt3[PTYX] && pt2yy == pt3[PTYY]) {
                    (
                        pt3[PTXX], pt3[PTXY],
                        pt3[PTYX], pt3[PTYY],
                        pt3[PTZX], pt3[PTZY]
                    ) = _ECTwistDoubleJacobian(pt1xx, pt1xy, pt1yx, pt1yy, pt1zx, pt1zy);
                    return pt3;
                }
                (
                    pt3[PTXX], pt3[PTXY],
                    pt3[PTYX], pt3[PTYY],
                    pt3[PTZX], pt3[PTZY]
                ) = (
                    1, 0,
                    1, 0,
                    0, 0
                );
                return pt3;
            }

            (pt2zx,     pt2zy)     = _FQ2Mul(pt1zx, pt1zy, pt2zx,     pt2zy);     // W = z1 * z2
            (pt1xx,     pt1xy)     = _FQ2Sub(pt2yx, pt2yy, pt3[PTYX], pt3[PTYY]); // U = U1 - U2
            (pt1yx,     pt1yy)     = _FQ2Sub(pt2xx, pt2xy, pt3[PTZX], pt3[PTZY]); // V = V1 - V2
            (pt1zx,     pt1zy)     = _FQ2Mul(pt1yx, pt1yy, pt1yx,     pt1yy);     // V_squared = V * V
            (pt2yx,     pt2yy)     = _FQ2Mul(pt1zx, pt1zy, pt3[PTZX], pt3[PTZY]); // V_squared_times_V2 = V_squared * V2
            (pt1zx,     pt1zy)     = _FQ2Mul(pt1zx, pt1zy, pt1yx,     pt1yy);     // V_cubed = V * V_squared
            (pt3[PTZX], pt3[PTZY]) = _FQ2Mul(pt1zx, pt1zy, pt2zx,     pt2zy);     // newz = V_cubed * W
            (pt2xx,     pt2xy)     = _FQ2Mul(pt1xx, pt1xy, pt1xx,     pt1xy);     // U * U
            (pt2xx,     pt2xy)     = _FQ2Mul(pt2xx, pt2xy, pt2zx,     pt2zy);     // U * U * W
            (pt2xx,     pt2xy)     = _FQ2Sub(pt2xx, pt2xy, pt1zx,     pt1zy);     // U * U * W - V_cubed
            (pt2zx,     pt2zy)     = _FQ2Muc(pt2yx, pt2yy, 2);                    // 2 * V_squared_times_V2
            (pt2xx,     pt2xy)     = _FQ2Sub(pt2xx, pt2xy, pt2zx,     pt2zy);     // A = U * U * W - V_cubed - 2 * V_squared_times_V2
            (pt3[PTXX], pt3[PTXY]) = _FQ2Mul(pt1yx, pt1yy, pt2xx,     pt2xy);     // newx = V * A
            (pt1yx,     pt1yy)     = _FQ2Sub(pt2yx, pt2yy, pt2xx,     pt2xy);     // V_squared_times_V2 - A
            (pt1yx,     pt1yy)     = _FQ2Mul(pt1xx, pt1xy, pt1yx,     pt1yy);     // U * (V_squared_times_V2 - A)
            (pt1xx,     pt1xy)     = _FQ2Mul(pt1zx, pt1zy, pt3[PTYX], pt3[PTYY]); // V_cubed * U2
            (pt3[PTYX], pt3[PTYY]) = _FQ2Sub(pt1yx, pt1yy, pt1xx,     pt1xy);     // newy = U * (V_squared_times_V2 - A) - V_cubed * U2
    }

    function _ECTwistDoubleJacobian(
        uint256 pt1xx, uint256 pt1xy,
        uint256 pt1yx, uint256 pt1yy,
        uint256 pt1zx, uint256 pt1zy
    ) internal pure returns(
        uint256 pt2xx, uint256 pt2xy,
        uint256 pt2yx, uint256 pt2yy,
        uint256 pt2zx, uint256 pt2zy
    ) {
        (pt2xx, pt2xy) = _FQ2Muc(pt1xx, pt1xy, 3);            // 3 * x
        (pt2xx, pt2xy) = _FQ2Mul(pt2xx, pt2xy, pt1xx, pt1xy); // W = 3 * x * x
        (pt1zx, pt1zy) = _FQ2Mul(pt1yx, pt1yy, pt1zx, pt1zy); // S = y * z
        (pt2yx, pt2yy) = _FQ2Mul(pt1xx, pt1xy, pt1yx, pt1yy); // x * y
        (pt2yx, pt2yy) = _FQ2Mul(pt2yx, pt2yy, pt1zx, pt1zy); // B = x * y * S
        (pt1xx, pt1xy) = _FQ2Mul(pt2xx, pt2xy, pt2xx, pt2xy); // W * W
        (pt2zx, pt2zy) = _FQ2Muc(pt2yx, pt2yy, 8);            // 8 * B
        (pt1xx, pt1xy) = _FQ2Sub(pt1xx, pt1xy, pt2zx, pt2zy); // H = W * W - 8 * B
        (pt2zx, pt2zy) = _FQ2Mul(pt1zx, pt1zy, pt1zx, pt1zy); // S_squared = S * S
        (pt2yx, pt2yy) = _FQ2Muc(pt2yx, pt2yy, 4);            // 4 * B
        (pt2yx, pt2yy) = _FQ2Sub(pt2yx, pt2yy, pt1xx, pt1xy); // 4 * B - H
        (pt2yx, pt2yy) = _FQ2Mul(pt2yx, pt2yy, pt2xx, pt2xy); // W * (4 * B - H)
        (pt2xx, pt2xy) = _FQ2Muc(pt1yx, pt1yy, 8);            // 8 * y
        (pt2xx, pt2xy) = _FQ2Mul(pt2xx, pt2xy, pt1yx, pt1yy); // 8 * y * y
        (pt2xx, pt2xy) = _FQ2Mul(pt2xx, pt2xy, pt2zx, pt2zy); // 8 * y * y * S_squared
        (pt2yx, pt2yy) = _FQ2Sub(pt2yx, pt2yy, pt2xx, pt2xy); // newy = W * (4 * B - H) - 8 * y * y * S_squared
        (pt2xx, pt2xy) = _FQ2Muc(pt1xx, pt1xy, 2);            // 2 * H
        (pt2xx, pt2xy) = _FQ2Mul(pt2xx, pt2xy, pt1zx, pt1zy); // newx = 2 * H * S
        (pt2zx, pt2zy) = _FQ2Mul(pt1zx, pt1zy, pt2zx, pt2zy); // S * S_squared
        (pt2zx, pt2zy) = _FQ2Muc(pt2zx, pt2zy, 8);            // newz = 8 * S * S_squared
    }

    function _ECTwistMulJacobian(
        uint256 d,
        uint256 pt1xx, uint256 pt1xy,
        uint256 pt1yx, uint256 pt1yy,
        uint256 pt1zx, uint256 pt1zy
    ) internal pure returns(uint256[6] memory pt2) {
        while (d != 0) {
            if ((d & 1) != 0) {
                pt2 = _ECTwistAddJacobian(
                    pt2[PTXX], pt2[PTXY],
                    pt2[PTYX], pt2[PTYY],
                    pt2[PTZX], pt2[PTZY],
                    pt1xx, pt1xy,
                    pt1yx, pt1yy,
                    pt1zx, pt1zy);
            }
            (
                pt1xx, pt1xy,
                pt1yx, pt1yy,
                pt1zx, pt1zy
            ) = _ECTwistDoubleJacobian(
                pt1xx, pt1xy,
                pt1yx, pt1yy,
                pt1zx, pt1zy
            );

            d = d / 2;
        }
    }
}



// This file is MIT Licensed.
//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

library Pairing {
    struct G1Point {
        uint X;
        uint Y;
    }
    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint[2] X;
        uint[2] Y;
    }
    /// @return the generator of G1
    function P1() pure internal returns (G1Point memory) {
        return G1Point(1, 2);
    }
    /// @return the generator of G2
    function P2() pure internal returns (G2Point memory) {
        return G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
    }
    /// @return the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negate(G1Point memory p) pure internal returns (G1Point memory) {
        // The prime q in the base field F_q for G1
        uint q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        if (p.X == 0 && p.Y == 0)
            return G1Point(0, 0);
        return G1Point(p.X, q - (p.Y % q));
    }
    /// @return the sum of two points of G1
    function addition(G1Point memory p1, G1Point memory p2) internal returns (G1Point memory r) {
        uint[4] memory input;
        input[0] = p1.X;
        input[1] = p1.Y;
        input[2] = p2.X;
        input[3] = p2.Y;

        assembly {
            let success := call(sub(gas, 2000), 6, 0, input, 0xc0, r, 0x60)
        }
    }
    /// @return the sum of two points of G2
    function addition(G2Point memory p1, G2Point memory p2) internal pure returns (G2Point memory r) {
        (r.X[1], r.X[0], r.Y[1], r.Y[0]) = BN256G2.ECTwistAdd(p1.X[1],p1.X[0],p1.Y[1],p1.Y[0],p2.X[1],p2.X[0],p2.Y[1],p2.Y[0]);
    }
    /// @return the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalar_mul(G1Point memory p, uint s) internal returns (G1Point memory r) {
        uint[3] memory input;
        input[0] = p.X;
        input[1] = p.Y;
        input[2] = s;

        assembly {
            let success := call(sub(gas, 2000), 7, 0, input, 0x80, r, 0x60)
        }
    }
    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2) internal returns (bool) {
        if (p1.length != p2.length) return false;
        uint elements = p1.length;
        uint inputSize = elements * 6;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 6 + 0] = p1[i].X;
            input[i * 6 + 1] = p1[i].Y;
            input[i * 6 + 2] = p2[i].X[0];
            input[i * 6 + 3] = p2[i].X[1];
            input[i * 6 + 4] = p2[i].Y[0];
            input[i * 6 + 5] = p2[i].Y[1];
        }
        uint[1] memory out;

        assembly {
            let success := call(sub(gas, 2000), 8, 0, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
        }

        return out[0] != 0;
    }
    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(G1Point memory a1, G2Point memory a2, G1Point memory b1, G2Point memory b2) internal returns (bool) {
        G1Point[] memory p1 = new G1Point[](2);
        G2Point[] memory p2 = new G2Point[](2);
        p1[0] = a1;
        p1[1] = b1;
        p2[0] = a2;
        p2[1] = b2;
        return pairing(p1, p2);
    }
    /// Convenience method for a pairing check for three pairs.
    function pairingProd3(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2
    ) internal returns (bool) {
        G1Point[] memory p1 = new G1Point[](3);
        G2Point[] memory p2 = new G2Point[](3);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        return pairing(p1, p2);
    }
    /// Convenience method for a pairing check for four pairs.
    function pairingProd4(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2,
            G1Point memory d1, G2Point memory d2
    ) internal returns (bool) {
        G1Point[] memory p1 = new G1Point[](4);
        G2Point[] memory p2 = new G2Point[](4);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p1[3] = d1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        p2[3] = d2;
        return pairing(p1, p2);
    }
}
library LzKSNARKVerifier {

  struct VerifyingKey {
    Pairing.G2Point A;
    Pairing.G1Point B;
    Pairing.G2Point C;
    Pairing.G2Point gamma;
    Pairing.G1Point gammaBeta1;
    Pairing.G2Point gammaBeta2;
    Pairing.G2Point Z;
    Pairing.G1Point[] IC;
  }

  struct Proof {
    Pairing.G1Point A;
    Pairing.G1Point A_p;
    Pairing.G2Point B;
    Pairing.G1Point B_p;
    Pairing.G1Point C;
    Pairing.G1Point C_p;
    Pairing.G1Point K;
    Pairing.G1Point H;
  }

  function verifyingKey() pure internal returns (VerifyingKey memory vk) {
    vk.A = Pairing.G2Point([0x669311a5f17050be6d7ffb9b908dbe32501a628a5671af5e7704ab896a09775,0x41de58000c80203eb81d921eb42afbf785fed0d7b38ac4d9e5844d55e834763],[0x25c8a6474cef68e68a405670954b3b413ff243f73e754971ac3eaf3c783fbbb6,0x2bb3a0f34f9fdb040a6105d810bcf8780b5e2c26afae9a82d78516c14873607c]);
    vk.B = Pairing.G1Point(0x222788274ec76b08a31bdf0f8523e05524edb119e6f2980e41b031bb57f3ac54,0x1067c54c5b7d014e9bec0b0f62f181a4eb276f4d3d576d60277450b57e9454b7);
    vk.C = Pairing.G2Point([0x8b05a3f473ab3199f63b004a52e00850913fb26ceef66f964b3d3963b15accc,0x84f83a7a210b861920b520932048e67e306dc79fa0954fc1dc4ea53f500320e],[0x27c0eea1ac3b84b4a757720eb9fe1bcb5c9d2710fde4ef5bfeecb609fe40dd5,0x519eb8e28b899d1a4c1ccfc950a1eff4ec1b0e9b1774bec6d549c0b6d4b0011]);
    vk.gamma = Pairing.G2Point([0x69ce412b7c3b6fbf649a715dd3c386d9a357062696a088df9ba1185e01d5263,0x217308129a2a0a8987c10d805341c3133dc8ad10083e528e4c5298d0246a9346],[0x1d2ff0e6ff5f342906704183892fb3987a6f579aa0e2a4a14a52cf3a2ef795ee,0x455303d862db78740528aef2db915ae67602a765a3090b546d082798a2f3386]);
    vk.gammaBeta1 = Pairing.G1Point(0x173624a92d4d8e423b3478e4fef9b6266c0ebc19f60561309be2692d1683c43e,0xf141bea0ae933bd68032e171154e0b27057f2bffbd5f2dbe81c3690a5ee0bd6);
    vk.gammaBeta2 = Pairing.G2Point([0x63ab6083eabcafd6302fe978923fc028b2b08d4c8870d7302d90221cfe5d9d3,0x18b5a91c67025d9b0d43fd6ce7578b88f09383a468a300eead5f362edce875be],[0x2d2d9fc27e1b7e3dbf1ef92c28bfeffe3281bd1325c761b7a57f7e23a996920e,0x48745114370c06d63eacfe9f6a1ab35dca6ec5e612d7082444ee2e8e8d77f0c]);
    vk.Z = Pairing.G2Point([0x1badf4d60963883e0219454844fcb4861bb3315e76f1e3954b9d721a7a5cc678,0x75e43aba4236a0d9fa5bb96f4b270b10454e540c685cdd4ddcda810669f9103],[0xbf7414305afbfa989806a388cdd272592988213daa509b23875d74080147c49,0x24081200e1f3882f1a0dcd4d7386d42f97136df0e057bd4771826c847c10fa9e]);
    vk.IC = new Pairing.G1Point[](20);

          vk.IC[0] = Pairing.G1Point(0x1e9edb214141b2dfb4879cc6d316c73e111e73657519d82d2751ad74f2a328d0,0x1e665365803ef0f7c2ed8b6d933993211bc4723c8115118c3caeaaa3eb7e0a04);
          vk.IC[1] = Pairing.G1Point(0x1a09c87b221e732faeb5deff8fc4c351a6a9ded3a6b5820a24a2c2303ac83bd6,0xa3f8221528fed979a465ee102ebeb4a97c74a3f9b83372465a44503865a9abc);
          vk.IC[2] = Pairing.G1Point(0x6c62959bef8e22b47b0ac5a99a69b955346f0f7a479c47a3315598f5c483b5b,0x9628a534a52f468476e9ea1e1975d0d25d6b5f2085b8fc8871b5b484268eb36);
          vk.IC[3] = Pairing.G1Point(0x13af312e44e854cfed4c2205e1802b3dfbc90b39ff258b7e45b7849b56fbd611,0x201802ac1b9a1bbf4692c67cbad146e795acbf4d33f172511da27bda0e50a2aa);
          vk.IC[4] = Pairing.G1Point(0x217bd343d27b910635b4d8112a0306bf8aa61ddb539a6037288ba115ad3e7d95,0x295145ac695c86e7f41dfbb8649a87fb8912cb7e728352b63baa15f2e8364007);
          vk.IC[5] = Pairing.G1Point(0x27cd9223b38d95b4b6a618cb8d41d2492a79722412ce138a601844f3cf4212e6,0x91b04162098f3a99dcdbef8aa1ab6ab39346546d7a1ae065a56e0df82f3431c);
          vk.IC[6] = Pairing.G1Point(0x2261dc330c7630dd9f190effbccb4d08389a189540dc41f6ca10e3e1b8301b41,0x7db97faa5fa6b3973124db592dc7ccc4f5b7ade022e6bbdc74c8e07fbcf6b3e);
          vk.IC[7] = Pairing.G1Point(0x242b977655a684e74bdff2f17cbd8d2073a88de416f6f48cdbb345024f379e70,0xef3e80a5d4bdd10fecd9c5521142bd33961db8e0e60b2945000165ba4aa2c9);
          vk.IC[8] = Pairing.G1Point(0x2b0d2d1f42800e038e3501d5dbec1f61a4b89ecb34bc8414f0252b4841dd9e5f,0x17cedcfce5bcbb16f60ee32e499ee5e788a39bc590f35a30855f109665cbe04a);
          vk.IC[9] = Pairing.G1Point(0x1ee61d868ce526c56f74bc3571293955711a20da4d4a0ff61994b118679dfb6e,0xecdb73b2329fd23f56900eac8b85d9d48c01083f4de23c840b50a5953da7cba);
          vk.IC[10] = Pairing.G1Point(0x1a0320d568b598df351bd29e9009c965be50a8ff92b4a79f96fe2be4714f65c1,0x2347e5b809a9728ce96dfe2aa871ca01d499995eb8c80a3923945029b907f4d9);
          vk.IC[11] = Pairing.G1Point(0xb34c853ec5cf516bf52e93919b73be8950bd5da0f8fbc920cd191f61241ec5,0x750ac94908d4249b9dd3465ebbf323c4fc677bb1ef38fd9a84a7f95cdb559ad);
          vk.IC[12] = Pairing.G1Point(0x42e516ab1b06d6f623325794bed52ec34ab0a7ad697cf2e1201470a78283714,0x2fbfc6a184fae7cda5771292de20fe99193784cbbac36110cb5f43cf4c5b8932);
          vk.IC[13] = Pairing.G1Point(0x25e3e68e8a4daf8aafebfc0881975cf54e0962f700ab546af28403a6fe75a6a7,0xd144f06016941bf87b8612b9ab04a9c236ac93a8b157736256ed1e7e115bece);
          vk.IC[14] = Pairing.G1Point(0x1cb7dd468a44ca88b1a2eaabf609090f767fde7971d61ddd37592a8f73bf7098,0x21d7e3404b2a354e33e8deaa0728b245ff565ac54327667d3d5084e8e2703d7c);
          vk.IC[15] = Pairing.G1Point(0x2a91acf1959a54f37a70588eb4da8c0a13c0a504130d4b2f1ef0a708892a47ef,0x2d6a1d08ebd5d6913cb413e222bb64745a9d2646319878613a24eb32f7aa4bea);
          vk.IC[16] = Pairing.G1Point(0x119d2e824353073973e7d12b030af0ff7ad78c6b732a0c46be1772d2c42a5fa0,0x12051848db3cdf5437c090ec437098aa28ae9c89e30619b5446b2ca9e59e03aa);
          vk.IC[17] = Pairing.G1Point(0x4b3f241b8ba3393291b50d9717b6232f1efdc41a4ef668b231dc9389c80ca72,0x29d1baa6ba8c256b72cf23a2e97cd8ddea71a66387b63c4cd06226e6503ae9da);
          vk.IC[18] = Pairing.G1Point(0x1426a131734d5ed55d430f6fc6a106a2dfd7f90754c9d88c72bf75f52254c3ae,0x2f6045fe07ed2d60cd01a5229142c6ee2e4336e74b83daaf3a220ccd50d8c911);
          vk.IC[19] = Pairing.G1Point(0x1c5c184a4917979c121f5d9383ac51a38e41550ff075e68e23dd0c84b6c70f5b,0x2c8a00ee2bb3a01a7776bc959b0f37fadc734950b926e16d17398909e09da1a5);

  }

  function verify(uint[] memory input, Proof memory proof)
    internal
    returns (bool)
  {
    VerifyingKey memory vk = verifyingKey();
    if (input.length + 1 != vk.IC.length) return false;
    // Compute the linear combination vk_x
    Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
    for (uint i = 0; i < input.length; i++)
      vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
    vk_x = Pairing.addition(vk_x, vk.IC[0]);
    if (!Pairing.pairingProd2(proof.A, vk.A, Pairing.negate(proof.A_p), Pairing.P2())) return false;
    if (!Pairing.pairingProd2(vk.B, proof.B, Pairing.negate(proof.B_p), Pairing.P2())) return false;
    if (!Pairing.pairingProd2(proof.C, vk.C, Pairing.negate(proof.C_p), Pairing.P2())) return false;
    if (!Pairing.pairingProd3(
        proof.K, vk.gamma,
        Pairing.negate(Pairing.addition(vk_x, Pairing.addition(proof.A, proof.C))), vk.gammaBeta2,
        Pairing.negate(vk.gammaBeta1), proof.B
    )) return false;
    if (!Pairing.pairingProd3(
        Pairing.addition(vk_x, proof.A), proof.B,
        Pairing.negate(proof.H), vk.Z,
        Pairing.negate(proof.C), Pairing.P2()
    )) return false;
    return true;
  }

  function verifySnarkProof(bytes calldata _encodedProof)
    external
    returns (bool)
  {
    (Proof memory proof, uint[] memory input) = decodeProof(_encodedProof);
    return verify(input, proof);
  }

  function decodeProof(bytes memory _encodedProof)
    private
    pure
    returns(Proof memory proof_, uint[] memory)
  {
    (
      uint[2] memory A,
      uint[2] memory A_p,
      uint[2] memory B1,
      uint[2] memory B2,
      uint[2] memory B_p,
      uint[2] memory C,
      uint[2] memory C_p,
      uint[2] memory K,
      uint[2] memory H,
      uint[] memory input_
    ) = abi.decode(_encodedProof, (uint[2], uint[2], uint[2], uint[2], uint[2], uint[2], uint[2], uint[2], uint[2], uint[]));

    proof_.A = Pairing.G1Point(A[0], A[1]);
    proof_.A_p = Pairing.G1Point(A_p[0], A_p[1]);
    proof_.B = Pairing.G2Point(B1, B2);
    proof_.B_p = Pairing.G1Point(B_p[0], B_p[1]);
    proof_.C = Pairing.G1Point(C[0], C[1]);
    proof_.C_p = Pairing.G1Point(C_p[0], C_p[1]);
    proof_.K = Pairing.G1Point(K[0], K[1]);
    proof_.H = Pairing.G1Point(H[0], H[1]);

    return (proof_, input_);
  }
}