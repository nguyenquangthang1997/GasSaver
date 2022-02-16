pragma solidity ^0.6.5;

contract UnOptimizedContract {
    function getData(uint256 a, bool b) external returns (uint256 c, uint256 d){
        uint256 squadB = b * b;
        for (uint256 i = 1; i < a; i++) {
            c += i * squadB;
        }
        for (uint256 i = 1; i < a; i++) {
            d += i * b;
        }
        return (c, d);
    }
}

contract OptimizedContract {

    function getData(uint256 a, bool b) external returns (uint256 c, uint256 d){
        uint256 squadB = b * b;
        for (uint256 i = 1; i < a; i++) {
            c += i * squadB;
            d += i * b;
        }
        return (c, d);
    }

}
