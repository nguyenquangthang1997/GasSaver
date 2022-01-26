pragma solidity ^0.5.13;

contract test1 {


    function thang1() public pure {

    }

}

contract test is test1 {
    uint256[] a;

    struct b {
        uint256 aa;
    }



    function doSomething() public {
        for (uint256 i = 0; i < 1000; i = i + 1) {
            b memory aaa = thang();
            //            aaa.aa = c;
        }

        for (uint256 i = 0; i < 1000; i = i + 1) {
            b memory aaa1 = thang();
            //            aaa.aa = c;
        }

        for (uint256 i = 0; i < 1000; i = i + 1) {
            b memory aaa1 = thang();
            //            aaa.aa = c;
        }
    }
}