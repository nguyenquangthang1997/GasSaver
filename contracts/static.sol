pragma solidity 0.6.6;

pragma experimental ABIEncoderV2;

contract Static1 {
    uint128 kqjd;
    uint256[] dd;
    uint128 kjd;

//    function a() public {
//        if(dd>0){
//            c = 1;
//        }
//    }

    modifier validRecipient() {
                dd++;
        _;
    }

    modifier validRecipient1() {
        uint256 d;
        _;
    }

    //    modifier validRecipient1() {
//
//        _;
//    }
//
//    function statistics(uint128 a, string memory b, uint128 c) public validRecipient validRecipient1 {
//        uint256[] storage e = new uint256[](6);
//
//        uint256 h = (a + c)+1;
//        a = 1;
//        c = a == 1 ? 0 : h;
//    }
//
//    function statistics1(uint128[] memory a, uint256 b, uint128 c) public {
//        uint256 e = c;
//    }
//
//    function statistics2(string memory a, uint256 b, uint128 c) public {
//        uint256 e = c;
//    }
//
//    function statistics3(bytes memory a, uint256 b, uint128 c) public {
//        uint256 e = c;
//    }
//
    function statistics4(bytes32 a, uint256 b, uint128 c) public validRecipient {
        uint256 e = c;
    }


}

//contract Static2 {
//
//    function statistics(string  memory b, uint128 a, uint128 c) public {
//        uint256 e = a + c;
//    }
//
//}

//contract Static1 {
//    uint256 a;
//
//    function statistics() public {
//        uint256 e;
//    }
//}
//
//contract Static2 {
//    uint256 a;
//
//    function statistics() public {
//        for (uint256 i = 0; i < a; i++) {
//            a++;
//        }
//    }
//}
//
//contract Static3 {
//    uint256 a;
//
//    function statistics() public {
//        uint256 e = a;
//        for (uint256 i = 0; i < e; i++) {
//            a++;
//        }
//    }
//}
//
//contract Static4 {
//    uint256 a;
//
//    function statistics() public {
//        for (uint256 i = 0; i < a; i++) {
//            a++;
//        }
//        for (uint256 i = 0; i < a; i++) {
//            a++;
//        }
//    }
//}
//
//contract Static5 {
//    uint256 a;
//
//    function statistics() public {
//        uint256 f = a;
//        uint256 g = a;
//        for (uint256 i = 0; i < f; i++) {
//            a++;
//        }
//        for (uint256 i = 0; i < g; i++) {
//            a++;
//        }
//    }
//}